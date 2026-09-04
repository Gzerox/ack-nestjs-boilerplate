import { Request } from 'express';
import { IAuthJwtAccessTokenPayload } from '@modules/auth/interfaces/auth.interface';

export interface IRequestGeoLocation {
    latitude: number;
    longitude: number;
    country: string;
    region: string;
    city: string;
}

export interface IRequestUserAgentBrowser {
    name?: string;
    version?: string;
    major?: string;
    type?: string;
}

export interface IRequestUserAgentCpu {
    architecture?: string;
}

export interface IRequestUserAgentDevice {
    type?: string;
    vendor?: string;
    model?: string;
}

export interface IRequestUserAgentEngine {
    name?: string;
    version?: string;
}

export interface IRequestUserAgentOs {
    name?: string;
    version?: string;
}

export interface IRequestUserAgent {
    ua?: string;
    browser?: IRequestUserAgentBrowser;
    cpu?: IRequestUserAgentCpu;
    device?: IRequestUserAgentDevice;
    engine?: IRequestUserAgentEngine;
    os?: IRequestUserAgentOs;
}

export interface IRequestApp<T = IAuthJwtAccessTokenPayload> extends Omit<
    Request,
    'user'
> {
    correlationId: string;
    user?: T;
}

export interface IRequestLog {
    userAgent: IRequestUserAgent;
    ipAddress?: string | null;
    geoLocation?: IRequestGeoLocation | null;
}
