export interface UserAgentBrowser {
    name?: string;
    version?: string;
    major?: string;
    type?: string;
}

export interface UserAgentCpu {
    architecture?: string;
}

export interface UserAgentDevice {
    type?: string;
    vendor?: string;
    model?: string;
}

export interface UserAgentEngine {
    name?: string;
    version?: string;
}

export interface UserAgentOs {
    name?: string;
    version?: string;
}

export interface UserAgent {
    ua?: string;
    browser?: UserAgentBrowser;
    cpu?: UserAgentCpu;
    device?: UserAgentDevice;
    engine?: UserAgentEngine;
    os?: UserAgentOs;
}

export interface GeoLocation {
    latitude: number;
    longitude: number;
    country: string;
    region: string;
    city: string;
}
