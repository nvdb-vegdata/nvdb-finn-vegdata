import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './api/apiConfig'
import './index.css'

function logQueryError(error: unknown) {
  if (!error) return

  if (typeof error === 'object' && error !== null && 'issues' in error && Array.isArray((error as { issues?: unknown }).issues)) {
    console.error('Zod validation error', (error as { issues: unknown }).issues)
    return
  }

  console.error(error)
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => logQueryError(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => logQueryError(error),
  }),
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retryOnMount: false,
      staleTime: Infinity,
      retry: false,
    },
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
