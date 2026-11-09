import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { BulkEmailStatus } from '@aws-sdk/client-ses';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import {
    EnumNotificationChannel,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { NotificationEmailTermPolicyDomain } from '@modules/notification/domains/notification.email.term-policy.domain';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type { INotificationEmailSendPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationEmailTermPolicyDomain', () => {
    const awsSESService = mock<AwsSESService>();
    const configService = mock<ConfigService>();
    const notificationRepository = mock<NotificationRepository>();
    let domain: NotificationEmailTermPolicyDomain;

    const send: INotificationEmailSendPayload[] = [
        {
            userId: 'user-1',
            notificationId: 'notification-1',
            email: 'nadia@example.com',
            username: 'nadia',
        },
        {
            userId: 'user-2',
            notificationId: 'notification-2',
            email: 'omar@example.com',
            username: 'omar',
        },
    ];
    const data = { type: EnumTermPolicyType.privacy, version: 3 };
    const content = {
        title: 'Term policy',
        body: 'Published',
        failureTokens: [],
    };
    const defaultTemplateData = {
        homeName: 'Home',
        supportEmail: 'support@example.com',
        homeUrl: 'https://home.example.com',
        type: data.type,
        version: '3',
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values: Record<string, unknown> = {
                'email.noreply': 'noreply@example.com',
                'email.support': 'support@example.com',
                'home.name': 'Home',
                'home.url': 'https://home.example.com',
            };

            return values[key];
        });
        awsSESService.classifyError.mockReturnValue({
            code: 'Error',
            cause: null,
        });
        notificationRepository.findForDelivery.mockResolvedValue(content);
        notificationRepository.findDeliveryStates.mockResolvedValue([]);
        const module = await Test.createTestingModule({
            providers: [
                NotificationEmailTermPolicyDomain,
                { provide: AwsSESService, useValue: awsSESService },
                { provide: ConfigService, useValue: configService },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
            ],
        }).compile();
        domain = module.get(NotificationEmailTermPolicyDomain);
    });

    describe('processPublishTermPolicy', () => {
        it('mails only the recipients in the job payload', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [
                    { Status: BulkEmailStatus.Success },
                    { Status: BulkEmailStatus.Success },
                ],
            });

            const result = await domain.processPublishTermPolicy(send, data);

            expect(notificationRepository.findForDelivery).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email
            );
            expect(notificationRepository.findForDelivery).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email
            );
            expect(awsSESService.sendBulk).toHaveBeenCalledTimes(1);
            expect(awsSESService.sendBulk).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.publishTermPolicy,
                recipients: [
                    {
                        recipient: 'nadia@example.com',
                        templateData: { username: 'nadia' },
                    },
                    {
                        recipient: 'omar@example.com',
                        templateData: { username: 'omar' },
                    },
                ],
                sender: 'noreply@example.com',
                defaultTemplateData,
            });
            expect(result).toEqual({
                message: 'Publish term policy email processed',
                sent: 2,
                failed: 0,
            });
        });

        it('drops recipients whose delivery is already sent', async () => {
            notificationRepository.findForDelivery
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(content);
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [{ Status: BulkEmailStatus.Success }],
            });

            await domain.processPublishTermPolicy(send, data);

            expect(awsSESService.sendBulk).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipients: [
                        {
                            recipient: 'omar@example.com',
                            templateData: { username: 'omar' },
                        },
                    ],
                })
            );
            expect(notificationRepository.markSent).toHaveBeenCalledTimes(1);
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('returns without sending when every delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processPublishTermPolicy(send, data);

            expect(awsSESService.sendBulk).not.toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'Every delivery already sent or missing, skipping publish term policy email',
            });
        });

        it('maps each bulk status to its notificationId', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [
                    { Status: BulkEmailStatus.Success },
                    {
                        Status: BulkEmailStatus.MessageRejected,
                        Error: 'rejected',
                    },
                ],
            });

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                messageProperties: { cause: 'bulkDeliveryFailed' },
            });

            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                []
            );
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('fails when every recipient is permanently rejected', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [
                    { Status: BulkEmailStatus.MessageRejected },
                    { Status: BulkEmailStatus.MessageRejected },
                ],
            });
            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                messageProperties: { cause: 'bulkDeliveryFailed' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledTimes(2);
        });

        it('treats a missing bulk status entry as a failure', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [{ Status: BulkEmailStatus.Success }],
            });

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                messageProperties: { cause: 'bulkDeliveryFailed' },
            });

            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('leaves every kept recipient pending when SES returns no bulk status', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [],
            });

            const result = await domain.processPublishTermPolicy(send, data);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping publish term policy email',
            });
        });

        it('writes nothing for the kept recipients when SES returns a missing bulk status', async () => {
            notificationRepository.findForDelivery
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(content);
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: undefined,
            });

            await domain.processPublishTermPolicy(send, data);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
        });

        it('marks a transient bulk status failed and throws', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [
                    { Status: BulkEmailStatus.Success },
                    {
                        Status: BulkEmailStatus.TransientFailure,
                        Error: 'try later',
                    },
                ],
            });

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                messageProperties: { cause: 'bulkDeliveryFailed' },
            });

            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                []
            );
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('marks every kept recipient failed and throws when sendBulk throws', async () => {
            const error = new Error('ses down');
            awsSESService.sendBulk.mockRejectedValue(error);

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({ messageProperties: { cause: 'Error' } });

            expect(notificationRepository.markFailed).toHaveBeenCalledTimes(2);
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                []
            );
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('marks every kept recipient failed and throws NotificationDeliveryFailedException when sendBulk rejects with a non-Error', async () => {
            awsSESService.sendBulk.mockRejectedValue('rejected');

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                module: 'notification',
                statusCode: EnumNotificationStatusCodeError.deliveryFailed,
                statusCodeKey: 'deliveryFailed',
                messagePath: 'notification.error.deliveryFailed',
            });

            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
        });

        it('re-sends a failed recipient on the retry and flips it to sent', async () => {
            awsSESService.sendBulk
                .mockResolvedValueOnce({
                    $metadata: {},
                    Status: [
                        { Status: BulkEmailStatus.Success },
                        {
                            Status: BulkEmailStatus.TransientFailure,
                            Error: 'try later',
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    $metadata: {},
                    Status: [
                        { Status: BulkEmailStatus.Success },
                        { Status: BulkEmailStatus.Success },
                    ],
                });

            await expect(
                domain.processPublishTermPolicy(send, data)
            ).rejects.toMatchObject({
                messageProperties: { cause: 'bulkDeliveryFailed' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );

            const result = await domain.processPublishTermPolicy(send, data);

            expect(awsSESService.sendBulk).toHaveBeenCalledTimes(2);
            expect(notificationRepository.markSent).toHaveBeenLastCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'Publish term policy email processed',
                sent: 2,
                failed: 0,
            });
        });
    });
});
