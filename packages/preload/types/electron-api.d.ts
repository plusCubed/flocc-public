interface ElectronApi {
  readonly sendSync: Readonly<(any) => void>;
  readonly send: Readonly<(any) => void>;
  readonly on: Readonly<(any) => void>;
  readonly once: Readonly<(any) => void>;
  readonly platform: string;
}

declare interface Window {
  electron: Readonly<ElectronApi>;
  electronRequire?: NodeRequire;
}
