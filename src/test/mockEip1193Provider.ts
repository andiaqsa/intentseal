export interface ProviderRequest {
  method: string;
  params?: readonly unknown[] | object;
}

type ProviderListener = (...args: unknown[]) => void;
type RequestHandler = (params: ProviderRequest["params"]) => unknown | Promise<unknown>;

export interface MockProviderOptions {
  accounts?: string[];
  chainId?: string;
  requestAccountsError?: unknown;
  switchError?: unknown;
  addChainError?: unknown;
}

export class MockEip1193Provider {
  readonly isMetaMask = true;
  readonly requests: ProviderRequest[] = [];

  accounts: string[];
  chainId: string;
  requestAccountsError?: unknown;
  switchError?: unknown;
  addChainError?: unknown;

  private readonly handlers = new Map<string, RequestHandler>();
  private readonly listeners = new Map<string, Set<ProviderListener>>();

  constructor(options: MockProviderOptions = {}) {
    this.accounts = options.accounts ?? [];
    this.chainId = options.chainId ?? "0x1";
    this.requestAccountsError = options.requestAccountsError;
    this.switchError = options.switchError;
    this.addChainError = options.addChainError;
  }

  async request(request: ProviderRequest): Promise<unknown> {
    this.requests.push({ method: request.method, params: request.params });

    const handler = this.handlers.get(request.method);
    if (handler) return handler(request.params);

    switch (request.method) {
      case "eth_accounts":
        return [...this.accounts];
      case "eth_requestAccounts":
        if (this.requestAccountsError) throw this.requestAccountsError;
        return [...this.accounts];
      case "eth_chainId":
        return this.chainId;
      case "wallet_switchEthereumChain": {
        if (this.switchError) throw this.switchError;
        const params = request.params as [{ chainId: string }];
        this.chainId = params[0].chainId;
        this.emit("chainChanged", this.chainId);
        return null;
      }
      case "wallet_addEthereumChain": {
        if (this.addChainError) throw this.addChainError;
        const params = request.params as [{ chainId: string }];
        this.chainId = params[0].chainId;
        this.emit("chainChanged", this.chainId);
        return null;
      }
      case "eth_blockNumber":
        return "0x1";
      case "eth_getBlockByNumber":
        return {
          hash: `0x${"1".repeat(64)}`,
          parentHash: `0x${"0".repeat(64)}`,
          number: "0x1",
          timestamp: "0x65ec8780",
          nonce: "0x0000000000000000",
          difficulty: "0x0",
          gasLimit: "0x1c9c380",
          gasUsed: "0x0",
          miner: "0x0000000000000000000000000000000000000000",
          extraData: "0x",
          transactions: [],
          baseFeePerGas: "0x1",
        };
      case "eth_call":
        return "0x";
      case "eth_sendTransaction":
        return `0x${"a".repeat(64)}`;
      case "eth_getTransactionReceipt":
        return null;
      default:
        throw providerError(-32601, `Unsupported mock RPC method: ${request.method}`);
    }
  }

  on(event: string, listener: ProviderListener): void {
    const eventListeners = this.listeners.get(event) ?? new Set<ProviderListener>();
    eventListeners.add(listener);
    this.listeners.set(event, eventListeners);
  }

  removeListener(event: string, listener: ProviderListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  setHandler(method: string, handler: RequestHandler): void {
    this.handlers.set(method, handler);
  }

  requestsFor(method: string): ProviderRequest[] {
    return this.requests.filter((request) => request.method === method);
  }
}

export function providerError(code: number, message: string): Error & { code: number } {
  return Object.assign(new Error(message), { code });
}

export function installMockProvider(provider?: MockEip1193Provider): void {
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    writable: true,
    value: provider,
  });
}
