import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { BulkEmailStatus } from '@aws-sdk/client-ses';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import {
    EnumNotificationChannel,
    EnumNotificationDeliveryStatus,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { NotificationEmailTermPolicyDomain } from '@modules/notification/domains/notification.email.term-policy.domain';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type { INotificationEmailSendPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { QueueException } from '@queues/exceptions/queue.exception';

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
        awsSESService.isInitialized.mockReturnValue(true);
        awsSESService.isRetryableBulkStatus.mockImplementation(
            (status: string) =>
                status === BulkEmailStatus.TransientFailure ||
                status === BulkEmailStatus.AccountThrottled ||
                status === BulkEmailStatus.Failed
        );
        awsSESService.classifyError.mockReturnValue({
            code: 'Error',
            isRetryable: true,
            retryAfterInMs: null,
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

            const result = await domain.processPublishTermPolicy(
                send,
                data,
                false
            );

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

            await domain.processPublishTermPolicy(send, data, false);

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

        it('reports an already failed delivery without sending', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);
            notificationRepository.findDeliveryStates.mockResolvedValue([
                {
                    userId: 'user-1',
                    notificationId: 'notification-1',
                    channel: EnumNotificationChannel.email,
                    status: EnumNotificationDeliveryStatus.failed,
                    lastError: 'previous failure',
                },
            ]);
            await expect(
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toMatchObject({ isRetryable: false });
            expect(awsSESService.sendBulk).not.toHaveBeenCalled();
        });

        it('returns without sending when every delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processPublishTermPolicy(
                send,
                data,
                false
            );

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
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toMatchObject({ isRetryable: false });

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
                BulkEmailStatus.MessageRejected,
                []
            );
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
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
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toMatchObject({ isRetryable: false });
            expect(notificationRepository.markFailed).toHaveBeenCalledTimes(2);
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
        });

        it('treats a missing bulk status entry as a retryable failure', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [{ Status: BulkEmailStatus.Success }],
            });

            await expect(
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toBeInstanceOf(QueueException);

            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                BulkEmailStatus.Failed,
                []
            );
        });

        it('does nothing per recipient when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processPublishTermPolicy(
                send,
                data,
                false
            );

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(awsSESService.sendBulk).not.toHaveBeenCalled();
            expect(
                notificationRepository.findDeliveryStates
            ).toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping publish term policy email',
            });
        });

        it('throws after marking when a recipient is retryable', async () => {
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
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toBeInstanceOf(QueueException);

            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                []
            );
            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                BulkEmailStatus.TransientFailure,
                []
            );
        });

        it('fails the job when the final bulk attempt has a failed recipient', async () => {
            awsSESService.sendBulk.mockResolvedValue({
                $metadata: {},
                Status: [
                    { Status: BulkEmailStatus.Success },
                    { Status: BulkEmailStatus.AccountThrottled },
                ],
            });
            await expect(
                domain.processPublishTermPolicy(send, data, true)
            ).rejects.toMatchObject({
                isRetryable: false,
            });
        });

        it('marks every kept recipient retry and rethrows when sendBulk throws a retryable error', async () => {
            const error = new Error('ses down');
            awsSESService.sendBulk.mockRejectedValue(error);

            await expect(
                domain.processPublishTermPolicy(send, data, false)
            ).rejects.toMatchObject({ isRetryable: true });

            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                'Error',
                []
            );
            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                'Error',
                []
            );
        });

        it('marks every kept recipient failed and rethrows when sendBulk throws a retryable error on the last attempt', async () => {
            const error = new Error('ses down');
            awsSESService.sendBulk.mockRejectedValue(error);

            await expect(
                domain.processPublishTermPolicy(send, data, true)
            ).rejects.toMatchObject({ isRetryable: false });

            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).toHaveBeenCalledTimes(2);
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-1',
                'notification-1',
                EnumNotificationChannel.email,
                'Error',
                []
            );
        });

        it('marks every kept recipient failed and throws NotificationDeliveryFailedException when sendBulk throws a permanent error', async () => {
            awsSESService.classifyError.mockReturnValue({
                code: 'Error',
                isRetryable: false,
                retryAfterInMs: null,
                cause: null,
            });
            awsSESService.sendBulk.mockRejectedValue('rejected');

            await expect(
                domain.processPublishTermPolicy(send, data, false)
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
                'Error',
                []
            );
        });

        it('does not re-send a permanently failed recipient on the retry after a mixed result', async () => {
            const recipients: INotificationEmailSendPayload[] = [
                ...send,
                {
                    userId: 'user-3',
                    notificationId: 'notification-3',
                    email: 'lina@example.com',
                    username: 'lina',
                },
            ];
            awsSESService.sendBulk
                .mockResolvedValueOnce({
                    $metadata: {},
                    Status: [
                        { Status: BulkEmailStatus.Success },
                        {
                            Status: BulkEmailStatus.MessageRejected,
                            Error: 'rejected',
                        },
                        {
                            Status: BulkEmailStatus.TransientFailure,
                            Error: 'try later',
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    $metadata: {},
                    Status: [{ Status: BulkEmailStatus.Success }],
                });

            await expect(
                domain.processPublishTermPolicy(recipients, data, false)
            ).rejects.toBeInstanceOf(QueueException);
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user-2',
                'notification-2',
                EnumNotificationChannel.email,
                BulkEmailStatus.MessageRejected,
                []
            );

            notificationRepository.findForDelivery
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(content);

            notificationRepository.findDeliveryStates.mockResolvedValue([
                {
                    userId: 'user-2',
                    notificationId: 'notification-2',
                    channel: EnumNotificationChannel.email,
                    status: EnumNotificationDeliveryStatus.failed,
                    lastError: 'MessageRejected',
                },
            ]);
            await expect(
                domain.processPublishTermPolicy(recipients, data, false)
            ).rejects.toMatchObject({ isRetryable: false });

            expect(awsSESService.sendBulk).toHaveBeenCalledTimes(2);
            expect(awsSESService.sendBulk).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    recipients: [
                        {
                            recipient: 'lina@example.com',
                            templateData: { username: 'lina' },
                        },
                    ],
                })
            );
            expect(notificationRepository.markSent).toHaveBeenLastCalledWith(
                'user-3',
                'notification-3',
                EnumNotificationChannel.email,
                []
            );
        });
    });
});
