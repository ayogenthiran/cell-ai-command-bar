import { NetworkRequest, RequestCallback } from '../types';
import { generateId } from '../utils/helpers';

/**
 * NetworkInterceptor captures XHR and Fetch API calls
 * to track user interactions with the application.
 */
class NetworkInterceptor {
  private callbacks: RequestCallback[] = [];
  private isIntercepting: boolean = false;
  private originalFetch: typeof fetch;
  private originalXhrOpen: any;
  private originalXhrSend: any;

  constructor() {
    // Store original methods
    this.originalFetch = window.fetch;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
  }

  /**
   * Start intercepting network requests
   */
  public start(): void {
    if (this.isIntercepting) return;
    
    this.interceptFetch();
    this.interceptXhr();
    
    this.isIntercepting = true;
    console.log('NetworkInterceptor: Started intercepting network requests');
  }

  /**
   * Stop intercepting network requests
   */
  public stop(): void {
    if (!this.isIntercepting) return;
    
    // Restore original methods
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXhrOpen;
    XMLHttpRequest.prototype.send = this.originalXhrSend;
    
    this.isIntercepting = false;
    console.log('NetworkInterceptor: Stopped intercepting network requests');
  }

  /**
   * Register a callback to be notified of network requests
   */
  public onRequest(callback: RequestCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a callback
   */
  public offRequest(callback: RequestCallback): void {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  /**
   * Intercept the Fetch API
   */
  private interceptFetch(): void {
    const self = this;
    
    window.fetch = function(input: RequestInfo, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || (typeof input === 'string' ? 'GET' : input.method || 'GET');
      const headers = init?.headers || (typeof input === 'string' ? {} : input.headers || {});
      const body = init?.body;

      // Create request object
      const request: NetworkRequest = {
        id: generateId(),
        url,
        method,
        headers: self.headersToObject(headers),
        body: body,
        timestamp: Date.now(),
        source: 'fetch'
      };

      // Notify callbacks
      self.notifyCallbacks(request);

      // Call original fetch
      return self.originalFetch.apply(this, [input, init]);
    };
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXhr(): void {
    const self = this;
    
    XMLHttpRequest.prototype.open = function(
      method: string, 
      url: string, 
      async: boolean = true, 
      username?: string | null, 
      password?: string | null
    ): void {
      // Store request details on the XHR object
      this.__cellRequest = {
        method,
        url,
        headers: {}
      };
      
      // Call original open
      self.originalXhrOpen.apply(this, arguments);
    };
    
    // Override setRequestHeader to capture headers
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string): void {
      if (this.__cellRequest) {
        this.__cellRequest.headers[name] = value;
      }
      originalSetRequestHeader.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (this.__cellRequest) {
        // Create request object
        const request: NetworkRequest = {
          id: generateId(),
          url: this.__cellRequest.url,
          method: this.__cellRequest.method,
          headers: this.__cellRequest.headers,
          body: body,
          timestamp: Date.now(),
          source: 'xhr'
        };
        
        // Notify callbacks
        self.notifyCallbacks(request);
      }
      
      // Call original send
      self.originalXhrSend.apply(this, arguments);
    };
  }

  /**
   * Notify all callbacks about a new request
   */
  private notifyCallbacks(request: NetworkRequest): void {
    this.callbacks.forEach(callback => {
      try {
        callback(request);
      } catch (error) {
        console.error('Error in NetworkInterceptor callback:', error);
      }
    });
  }

  /**
   * Convert Headers object to plain object
   */
  private headersToObject(headers: any): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (typeof headers === 'object') {
      Object.keys(headers).forEach(key => {
        result[key] = headers[key].toString();
      });
    }
    
    return result;
  }
}

export default NetworkInterceptor; 