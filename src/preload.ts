import { contextBridge } from 'electron';
import type { NetXScanApi } from './shared/preload-api';

const api: NetXScanApi = Object.freeze({});

contextBridge.exposeInMainWorld('netxscan', api);
