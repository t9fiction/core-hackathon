import { renderHook, waitFor } from '@testing-library/react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { useSmartContractRead } from '../useSmartContract'
import { showErrorAlert, showSuccessAlert } from '../../swal-config'
import { useAirdrop } from '../useAirdrop'

// Mock the dependencies
jest.mock('wagmi')
jest.mock('../useSmartContract')
jest.mock('../../swal-config')

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseWriteContract = useWriteContract as jest.MockedFunction<typeof useWriteContract>
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as jest.MockedFunction<typeof useWaitForTransactionReceipt>
const mockUseChainId = useChainId as jest.MockedFunction<typeof useChainId>
const mockUseSmartContractRead = useSmartContractRead as jest.MockedFunction<typeof useSmartContractRead>
const mockShowErrorAlert = showErrorAlert as jest.MockedFunction<typeof showErrorAlert>
const mockShowSuccessAlert = showSuccessAlert as jest.MockedFunction<typeof showSuccessAlert>

describe('useAirdrop', () => {
  const mockWriteContract = jest.fn()
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockTokenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
  const mockHash = '0xhash123'
  const mockMerkleRoot = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 1,
    } as any)
    
    mockUseWriteContract.mockReturnValue({
      writeContract: mockWriteContract,
      data: mockHash,
      isPending: false,
    } as any)
    
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
    } as any)
    
    mockUseChainId.mockReturnValue(1)
    
    mockUseSmartContractRead.mockReturnValue({
      data: null,
    } as any)
  })

  describe('configureAirdrop', () => {
    it('should configure airdrop successfully', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        86400 // 1 day
      )

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'configureAirdrop',
        args: [mockTokenAddress, mockMerkleRoot, BigInt(10000), 86400],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        86400
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to configure airdrops'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate merkle root', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        '0xinvalid',
        BigInt(10000),
        86400
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a valid merkle root'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate total amount', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(0),
        86400
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Total amount must be greater than 0'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate duration', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        0
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Duration must be greater than 0'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should handle contract errors', async () => {
      const error = new Error('Contract error')
      mockWriteContract.mockRejectedValue(error)

      const { result } = renderHook(() => useAirdrop())
      
      try {
        await result.current.configureAirdrop(
          mockTokenAddress as any,
          mockMerkleRoot,
          BigInt(10000),
          86400
        )
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Transaction Failed',
        'Failed to configure airdrop'
      )
    })
  })

  describe('claimAirdrop', () => {
    const mockProof = ['0xproof1', '0xproof2', '0xproof3']

    it('should claim airdrop successfully', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.claimAirdrop(
        mockTokenAddress as any,
        BigInt(1000),
        mockProof
      )

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'claimTokens',
        args: [mockTokenAddress, BigInt(1000), mockProof],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      
      await result.current.claimAirdrop(
        mockTokenAddress as any,
        BigInt(1000),
        mockProof
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to claim airdrop'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate claim amount', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.claimAirdrop(
        mockTokenAddress as any,
        BigInt(0),
        mockProof
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Claim amount must be greater than 0'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate merkle proof', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.claimAirdrop(
        mockTokenAddress as any,
        BigInt(1000),
        []
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a valid merkle proof'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should handle contract errors', async () => {
      const error = new Error('Claim failed')
      mockWriteContract.mockRejectedValue(error)

      const { result } = renderHook(() => useAirdrop())
      
      try {
        await result.current.claimAirdrop(
          mockTokenAddress as any,
          BigInt(1000),
          mockProof
        )
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Transaction Failed',
        'Failed to claim airdrop'
      )
    })
  })

  describe('emergencyWithdraw', () => {
    it('should perform emergency withdraw successfully', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.emergencyWithdraw(
        mockTokenAddress as any,
        mockAddress as any,
        BigInt(5000)
      )

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'emergencyWithdraw',
        args: [mockTokenAddress, mockAddress, BigInt(5000)],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      
      await result.current.emergencyWithdraw(
        mockTokenAddress as any,
        mockAddress as any,
        BigInt(5000)
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to perform emergency withdraw'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should validate withdrawal amount', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.emergencyWithdraw(
        mockTokenAddress as any,
        mockAddress as any,
        BigInt(0)
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Withdrawal amount must be greater than 0'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should handle contract errors', async () => {
      const error = new Error('Withdrawal failed')
      mockWriteContract.mockRejectedValue(error)

      const { result } = renderHook(() => useAirdrop())
      
      try {
        await result.current.emergencyWithdraw(
          mockTokenAddress as any,
          mockAddress as any,
          BigInt(5000)
        )
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Transaction Failed',
        'Failed to perform emergency withdrawal'
      )
    })
  })

  describe('data fetching', () => {
    it('should fetch airdrop info', () => {
      const mockAirdropInfo = [
        mockMerkleRoot,
        BigInt(10000),
        BigInt(Date.now() / 1000),
        BigInt(Date.now() / 1000 + 86400),
        true,
        BigInt(5000)
      ]

      mockUseSmartContractRead.mockReturnValue({
        data: mockAirdropInfo,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      
      expect(result.current.getAirdropInfo(mockTokenAddress as any)).toEqual({
        merkleRoot: mockMerkleRoot,
        totalAmount: BigInt(10000),
        startTime: mockAirdropInfo[2],
        endTime: mockAirdropInfo[3],
        active: true,
        claimedAmount: BigInt(5000)
      })
    })

    it('should check if airdrop is active', () => {
      mockUseSmartContractRead.mockReturnValue({
        data: true,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      expect(result.current.isAirdropActive(mockTokenAddress as any)).toBe(true)
    })

    it('should check if user can claim', () => {
      mockUseSmartContractRead.mockReturnValue({
        data: true,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      expect(result.current.canClaim(mockTokenAddress as any, mockAddress as any)).toBe(true)
    })

    it('should get contract stats', () => {
      const mockStats = [
        BigInt(10), // totalAirdropsConfigured
        BigInt(50000), // totalTokensDistributed
        BigInt(1000) // totalClaims
      ]

      mockUseSmartContractRead.mockReturnValue({
        data: mockStats,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      
      expect(result.current.getContractStats()).toEqual({
        totalAirdropsConfigured: BigInt(10),
        totalTokensDistributed: BigInt(50000),
        totalClaims: BigInt(1000)
      })
    })
  })

  describe('transaction states', () => {
    it('should return correct pending state', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: mockHash,
        isPending: true,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      expect(result.current.isPending).toBe(true)
    })

    it('should return correct confirming state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      expect(result.current.isConfirming).toBe(true)
    })

    it('should return correct confirmed state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      expect(result.current.isConfirmed).toBe(true)
    })

    it('should return transaction hash', () => {
      const { result } = renderHook(() => useAirdrop())
      expect(result.current.transactionHash).toBe(mockHash)
    })
  })

  describe('edge cases', () => {
    it('should handle null contract addresses', async () => {
      // Mock getContractAddresses to return null addresses
      jest.doMock('../../contracts/addresses', () => ({
        getContractAddresses: () => ({
          CHAINCRAFT_GOVERNANCE_AIRDROP: null
        })
      }))

      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        86400
      )

      // Should still attempt to call writeContract with the contract address
      expect(mockWriteContract).toHaveBeenCalled()
    })

    it('should handle empty airdrop info data', () => {
      mockUseSmartContractRead.mockReturnValue({
        data: null,
      } as any)

      const { result } = renderHook(() => useAirdrop())
      const airdropInfo = result.current.getAirdropInfo(mockTokenAddress as any)
      
      expect(airdropInfo).toBeUndefined()
    })

    it('should handle undefined token address', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      await result.current.configureAirdrop(
        undefined as any,
        mockMerkleRoot,
        BigInt(10000),
        86400
      )

      // Should handle gracefully and not crash
      expect(mockWriteContract).toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete airdrop lifecycle', async () => {
      const { result } = renderHook(() => useAirdrop())
      
      // Configure airdrop
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        86400
      )

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'configureAirdrop'
        })
      )

      // Claim airdrop
      const mockProof = ['0xproof1', '0xproof2']
      await result.current.claimAirdrop(
        mockTokenAddress as any,
        BigInt(1000),
        mockProof
      )

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'claimTokens'
        })
      )

      expect(mockWriteContract).toHaveBeenCalledTimes(2)
    })

    it('should handle error recovery', async () => {
      mockWriteContract.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useAirdrop())
      
      // First call should fail
      try {
        await result.current.configureAirdrop(
          mockTokenAddress as any,
          mockMerkleRoot,
          BigInt(10000),
          86400
        )
      } catch (error) {
        expect(error.message).toBe('Network error')
      }

      // Second call should succeed
      await result.current.configureAirdrop(
        mockTokenAddress as any,
        mockMerkleRoot,
        BigInt(10000),
        86400
      )

      expect(mockWriteContract).toHaveBeenCalledTimes(2)
    })
  })
})
