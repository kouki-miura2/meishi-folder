const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let loading: Promise<typeof google.accounts.id> | null = null

/** Loads Google Identity Services once; later calls reuse the same script. */
const loadGoogleIdentity = () =>
  (loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(google.accounts.id)
    script.onerror = () => {
      loading = null
      reject(new Error('Google Identity Services could not be loaded'))
    }
    document.head.append(script)
  }))

/**
 * Prepares "Sign in with Google": `onCredential` receives the ID token the backend trades for its
 * own session. `auto_select` lets a returning user sign back in without a click once the session
 * has expired.
 */
export const initGoogleSignIn = async (onCredential: (idToken: string) => void) => {
  const id = await loadGoogleIdentity()
  id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: (response) => onCredential(response.credential),
    auto_select: true,
    use_fedcm_for_prompt: true,
  })
  return id
}

/** Stops the automatic sign-in after an explicit sign-out. */
export const disableGoogleAutoSelect = () => {
  if (loading) void loading.then((id) => id.disableAutoSelect())
}
