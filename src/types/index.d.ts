export {}

type FunctionAPI = (channel: string, callback: any) => void
type InvokeAPI = (channel: string, arg?: any) => Promise<void>

interface API {
  invoke: InvokeAPI 
  onSuccess: FunctionAPI
  onError: FunctionAPI
}

declare global {
  interface Window {
    api: API
  }
}
