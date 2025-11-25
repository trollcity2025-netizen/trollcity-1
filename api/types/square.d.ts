declare module 'square' {
  export interface SquareClientConfig {
    bearerAuthCredentials: {
      accessToken: string
    }
    environment: Environment
  }

  export enum Environment {
    Production = 'production',
    Sandbox = 'sandbox'
  }

  export class Client {
    constructor(config: SquareClientConfig)
    paymentsApi: {
      createPayment: (params: any) => Promise<any>
    }
  }
}