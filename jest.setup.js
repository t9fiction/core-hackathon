import '@testing-library/jest-dom'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}))

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    chainId: 1,
  })),
  useWriteContract: jest.fn(() => ({
    writeContract: jest.fn(),
    data: null,
    isPending: false,
  })),
  useWaitForTransactionReceipt: jest.fn(() => ({
    isLoading: false,
    isSuccess: false,
  })),
  useChainId: jest.fn(() => 1),
  usePublicClient: jest.fn(() => ({})),
}))

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  QueryClient: jest.fn(() => ({})),
  QueryClientProvider: ({ children }) => children,
}))

// Mock SweetAlert2
jest.mock('../src/lib/swal-config', () => ({
  showSuccessAlert: jest.fn(),
  showErrorAlert: jest.fn(),
  showWarningAlert: jest.fn(),
  showInfoAlert: jest.fn(),
}))

// Global test utilities
global.BigInt = (n) => n
global.fetch = jest.fn()

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}
