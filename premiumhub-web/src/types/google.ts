export interface GoogleCredentialResponse {
  credential: string
  select_by?: string
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'small' | 'medium' | 'large'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
}

interface GoogleInitializeConfig {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  ux_mode?: 'popup' | 'redirect'
}

interface GoogleAccountsIdApi {
  initialize: (config: GoogleInitializeConfig) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
  prompt: () => void
}

interface GoogleNamespace {
  accounts: {
    id: GoogleAccountsIdApi
  }
}

declare global {
  interface Window {
    google?: GoogleNamespace
  }
}

export {}
