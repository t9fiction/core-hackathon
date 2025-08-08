import { renderHook } from '@testing-library/react'
import { useReadContract, useAccount, useChainId, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useSmartContractRead, useCurrentClient, useIsFallbackMode } from '../useSmartContract'

// Mock dependencies
jest.mock('wagmi')
jest.mock('@tanstack/react-query')
jest.mock('../../fallback-wallet', () => ({
  createFallbackPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
  })),
}))

const mockUseReadContract = useReadContract as jest.MockedFunction<typeof useReadContract>
const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseChainId = useChainId as jest.MockedFunction<typeof useChainId>
const mockUsePublicClient = usePublicClient as jest.MockedFunction<typeof usePublicClient>
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

describe('useSmartContractRead', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockAbi = [{ name: 'test', type: 'function' }]
  const mockReadContract = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAccount.mockReturnValue({
      isConnected: true,
    } as any)

    mockUseChainId.mockReturnValue(1)

    mockUsePublicClient.mockReturnValue({
      readContract: mockReadContract,
    } as any)

    mockUseReadContract.mockReturnValue({
      data: 'mock data',
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    } as any)

    mockUseQuery.mockReturnValue({
      data: 'fallback data',
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    } as any)
  })

  describe('Connected Wallet Mode', () => {
    it('should use wagmi useReadContract when wallet is connected', () => {
      const { result } = renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          args: [mockAddress],
        })
      )

      expect(mockUseReadContract).toHaveBeenCalledWith({
        address: mockAddress,
        abi: mockAbi,
        functionName: 'balanceOf',
        args: [mockAddress],
        query: {
          enabled: true,
        },
      })

      expect(result.current.data).toBe('mock data')
    })

    it('should handle disabled queries when connected', () => {
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          enabled: false,
        })
      )

      expect(mockUseReadContract).toHaveBeenCalledWith({
        address: mockAddress,
        abi: mockAbi,
        functionName: 'balanceOf',
        args: undefined,
        query: {
          enabled: false,
        },
      })
    })
  })

  describe('Fallback Mode', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
      } as any)
    })

    it('should use fallback client when wallet is not connected', () => {
      const { result } = renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          args: [mockAddress],
        })
      )

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['fallback-read', mockAddress, 'balanceOf', expect.any(Array), 1],
        queryFn: expect.any(Function),
        enabled: true,
        staleTime: 1000 * 60 * 5,
        refetchInterval: 1000 * 30,
      })

      expect(result.current.data).toBe('fallback data')
    })

    it('should handle disabled queries in fallback mode', () => {
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          enabled: false,
        })
      )

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: expect.any(Array),
        queryFn: expect.any(Function),
        enabled: false,
        staleTime: 1000 * 60 * 5,
        refetchInterval: 1000 * 30,
      })
    })

    it('should serialize BigInt values in query key', () => {
      const bigIntArg = BigInt('12345678901234567890')
      
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          args: [bigIntArg],
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      const queryKey = queryCall.queryKey as any[]
      
      // BigInt should be serialized to string in query key
      expect(queryKey[3]).toContain('12345678901234567890')
    })
  })

  describe('BigInt Serialization', () => {
    it('should serialize BigInt results from fallback client', async () => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
      
      const mockFallbackClient = {
        readContract: jest.fn().mockResolvedValue({
          balance: BigInt('1000000000000000000'),
          count: BigInt('42'),
          nested: {
            amount: BigInt('500'),
          },
        }),
      }

      const { createFallbackPublicClient } = require('../../fallback-wallet')
      createFallbackPublicClient.mockReturnValue(mockFallbackClient)

      // Get the query function from the mock call
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'getData',
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      const result = await queryCall.queryFn()

      // BigInt values should be converted to strings
      expect(result).toEqual({
        balance: '1000000000000000000',
        count: '42',
        nested: {
          amount: '500',
        },
      })
    })

    it('should handle arrays with BigInt values', async () => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
      
      const mockFallbackClient = {
        readContract: jest.fn().mockResolvedValue([
          BigInt('100'),
          BigInt('200'),
          'string value',
          { amount: BigInt('300') },
        ]),
      }

      const { createFallbackPublicClient } = require('../../fallback-wallet')
      createFallbackPublicClient.mockReturnValue(mockFallbackClient)

      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'getArray',
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      const result = await queryCall.queryFn()

      expect(result).toEqual([
        '100',
        '200',
        'string value',
        { amount: '300' },
      ])
    })

    it('should preserve non-BigInt values during serialization', async () => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
      
      const mockFallbackClient = {
        readContract: jest.fn().mockResolvedValue({
          number: 42,
          string: 'hello',
          boolean: true,
          null: null,
          undefined: undefined,
          bigint: BigInt('999'),
        }),
      }

      const { createFallbackPublicClient } = require('../../fallback-wallet')
      createFallbackPublicClient.mockReturnValue(mockFallbackClient)

      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'getMixed',
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      const result = await queryCall.queryFn()

      expect(result).toEqual({
        number: 42,
        string: 'hello',
        boolean: true,
        null: null,
        undefined: undefined,
        bigint: '999',
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle errors from fallback client', async () => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
      
      const mockError = new Error('Contract call failed')
      const mockFallbackClient = {
        readContract: jest.fn().mockRejectedValue(mockError),
      }

      const { createFallbackPublicClient } = require('../../fallback-wallet')
      createFallbackPublicClient.mockReturnValue(mockFallbackClient)

      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'failingFunction',
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      
      try {
        await queryCall.queryFn()
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBe(mockError)
      }
    })

    it('should log fallback warnings', async () => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const mockError = new Error('Fallback not available')
      const mockFallbackClient = {
        readContract: jest.fn().mockRejectedValue(mockError),
      }

      const { createFallbackPublicClient } = require('../../fallback-wallet')
      createFallbackPublicClient.mockReturnValue(mockFallbackClient)

      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'testFunction',
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      
      try {
        await queryCall.queryFn()
      } catch (error) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith('Fallback wallet not available:', mockError)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Query Configuration', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({ isConnected: false } as any)
    })

    it('should use correct stale time and refetch interval for fallback', () => {
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'test',
        })
      )

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: 1000 * 60 * 5, // 5 minutes
          refetchInterval: 1000 * 30, // 30 seconds
        })
      )
    })

    it('should generate unique query keys', () => {
      renderHook(() =>
        useSmartContractRead({
          address: mockAddress as any,
          abi: mockAbi,
          functionName: 'balanceOf',
          args: [mockAddress],
        })
      )

      const queryCall = mockUseQuery.mock.calls[0][0]
      expect(queryCall.queryKey).toEqual([
        'fallback-read',
        mockAddress,
        'balanceOf',
        [mockAddress],
        1,
      ])
    })
  })
})

describe('useCurrentClient', () => {
  const mockPublicClient = { test: 'connected client' }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChainId.mockReturnValue(1)
  })

  it('should return public client when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any)
    mockUsePublicClient.mockReturnValue(mockPublicClient as any)

    const { result } = renderHook(() => useCurrentClient())
    expect(result.current).toBe(mockPublicClient)
  })

  it('should return fallback client when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false } as any)
    mockUsePublicClient.mockReturnValue(null as any)

    const mockFallbackClient = { test: 'fallback client' }
    const { createFallbackPublicClient } = require('../../fallback-wallet')
    createFallbackPublicClient.mockReturnValue(mockFallbackClient)

    const { result } = renderHook(() => useCurrentClient())
    expect(result.current).toBe(mockFallbackClient)
    expect(createFallbackPublicClient).toHaveBeenCalledWith(1)
  })

  it('should return fallback client when public client is null', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any)
    mockUsePublicClient.mockReturnValue(null as any)

    const mockFallbackClient = { test: 'fallback client' }
    const { createFallbackPublicClient } = require('../../fallback-wallet')
    createFallbackPublicClient.mockReturnValue(mockFallbackClient)

    const { result } = renderHook(() => useCurrentClient())
    expect(result.current).toBe(mockFallbackClient)
  })
})

describe('useIsFallbackMode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return false when connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: true } as any)

    const { result } = renderHook(() => useIsFallbackMode())
    expect(result.current).toBe(false)
  })

  it('should return true when not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false } as any)

    const { result } = renderHook(() => useIsFallbackMode())
    expect(result.current).toBe(true)
  })
})

describe('serializeBigInt function', () => {
  // We'll test this indirectly through the hook since it's not exported
  it('should handle deeply nested BigInt values', async () => {
    mockUseAccount.mockReturnValue({ isConnected: false } as any)
    
    const mockFallbackClient = {
      readContract: jest.fn().mockResolvedValue({
        level1: {
          level2: {
            level3: [
              { amount: BigInt('123456789') },
              { balance: BigInt('987654321') },
            ],
          },
        },
      }),
    }

    const { createFallbackPublicClient } = require('../../fallback-wallet')
    createFallbackPublicClient.mockReturnValue(mockFallbackClient)

    renderHook(() =>
      useSmartContractRead({
        address: '0x123' as any,
        abi: [],
        functionName: 'getDeepData',
      })
    )

    const queryCall = mockUseQuery.mock.calls[0][0]
    const result = await queryCall.queryFn()

    expect(result).toEqual({
      level1: {
        level2: {
          level3: [
            { amount: '123456789' },
            { balance: '987654321' },
          ],
        },
      },
    })
  })

  it('should handle empty and null values', async () => {
    mockUseAccount.mockReturnValue({ isConnected: false } as any)
    
    const mockFallbackClient = {
      readContract: jest.fn().mockResolvedValue({
        emptyArray: [],
        emptyObject: {},
        nullValue: null,
        bigintValue: BigInt('42'),
      }),
    }

    const { createFallbackPublicClient } = require('../../fallback-wallet')
    createFallbackPublicClient.mockReturnValue(mockFallbackClient)

    renderHook(() =>
      useSmartContractRead({
        address: '0x123' as any,
        abi: [],
        functionName: 'getEmptyData',
      })
    )

    const queryCall = mockUseQuery.mock.calls[0][0]
    const result = await queryCall.queryFn()

    expect(result).toEqual({
      emptyArray: [],
      emptyObject: {},
      nullValue: null,
      bigintValue: '42',
    })
  })
})
