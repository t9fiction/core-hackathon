import { renderHook, waitFor } from '@testing-library/react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { useSmartContractRead } from '../useSmartContract'
import { showErrorAlert, showSuccessAlert } from '../../swal-config'
import { 
  useGovernance, 
  useProposal, 
  useAllProposals, 
  useHasVoted,
  getProposalTypeConfig,
  getProposalStatus,
  getTimeRemaining,
  PROPOSAL_TYPES 
} from '../useGovernance'

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

describe('useGovernance', () => {
  const mockWriteContract = jest.fn()
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockTokenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
  const mockHash = '0xhash123'

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
      data: BigInt(5),
    } as any)
  })

  describe('createProposal', () => {
    it('should create a proposal successfully', async () => {
      const { result } = renderHook(() => useGovernance())
      
      await result.current.createProposal(
        mockTokenAddress as any,
        'Test proposal',
        1,
        BigInt(1000),
        [],
        []
      )

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'createProposal',
        args: [mockTokenAddress, 'Test proposal', BigInt(1), BigInt(1000), [], []],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useGovernance())
      
      await result.current.createProposal(
        mockTokenAddress as any,
        'Test proposal',
        1,
        BigInt(1000),
        [],
        []
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to create proposals'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should show error for empty description', async () => {
      const { result } = renderHook(() => useGovernance())
      
      await result.current.createProposal(
        mockTokenAddress as any,
        '',
        1,
        BigInt(1000),
        [],
        []
      )

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a proposal description'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })

    it('should handle contract errors', async () => {
      const error = new Error('Contract error')
      mockWriteContract.mockRejectedValue(error)

      const { result } = renderHook(() => useGovernance())
      
      try {
        await result.current.createProposal(
          mockTokenAddress as any,
          'Test proposal',
          1,
          BigInt(1000),
          [],
          []
        )
      } catch (e) {
        expect(e).toBe(error)
      }

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Transaction Failed',
        'Failed to create proposal'
      )
    })
  })

  describe('vote', () => {
    it('should cast a vote successfully', async () => {
      const { result } = renderHook(() => useGovernance())
      
      await result.current.vote(1, true)

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'vote',
        args: [BigInt(1), true],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useGovernance())
      
      await result.current.vote(1, true)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to vote'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })
  })

  describe('executeProposal', () => {
    it('should execute a proposal successfully', async () => {
      const { result } = renderHook(() => useGovernance())
      
      await result.current.executeProposal(1)

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'executeProposal',
        args: [BigInt(1)],
      })
    })

    it('should show error when wallet is not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      const { result } = renderHook(() => useGovernance())
      
      await result.current.executeProposal(1)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Wallet Not Connected',
        'Please connect your wallet to execute proposals'
      )
      expect(mockWriteContract).not.toHaveBeenCalled()
    })
  })

  describe('proposal count', () => {
    it('should return proposal count', () => {
      const { result } = renderHook(() => useGovernance())
      expect(result.current.proposalCount).toBe(BigInt(5))
    })
  })

  describe('transaction states', () => {
    it('should return correct pending state', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: mockHash,
        isPending: true,
      } as any)

      const { result } = renderHook(() => useGovernance())
      expect(result.current.isPending).toBe(true)
    })

    it('should return correct confirming state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
      } as any)

      const { result } = renderHook(() => useGovernance())
      expect(result.current.isConfirming).toBe(true)
    })

    it('should return correct confirmed state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
      } as any)

      const { result } = renderHook(() => useGovernance())
      expect(result.current.isConfirmed).toBe(true)
    })
  })
})

describe('useProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChainId.mockReturnValue(1)
  })

  it('should fetch proposal data', () => {
    const mockProposalData = [
      mockAddress, // creator
      mockAddress, // token
      'Test proposal', // description
      BigInt(1000), // votesFor
      BigInt(500), // votesAgainst
      BigInt(Date.now() / 1000 + 86400), // endTime
      false, // executed
      true, // active
      1, // proposalType
      BigInt(1000), // proposedValue
      [], // recipients
      [], // amounts
    ]

    mockUseSmartContractRead.mockReturnValue({
      data: mockProposalData,
    } as any)

    const { result } = renderHook(() => useProposal(1))

    expect(result.current.proposal).toEqual({
      id: 1,
      creator: mockAddress,
      token: mockAddress,
      description: 'Test proposal',
      votesFor: BigInt(1000),
      votesAgainst: BigInt(500),
      endTime: mockProposalData[5],
      executed: false,
      active: true,
      proposalType: 1,
      proposedValue: BigInt(1000),
      recipients: [],
      amounts: [],
    })
  })

  it('should return undefined for invalid proposal data', () => {
    mockUseSmartContractRead.mockReturnValue({
      data: ['incomplete', 'data'],
    } as any)

    const { result } = renderHook(() => useProposal(1))
    expect(result.current.proposal).toBeUndefined()
  })

  it('should not fetch when proposal ID is undefined', () => {
    const { result } = renderHook(() => useProposal(undefined))
    expect(result.current.proposal).toBeUndefined()
  })
})

describe('useHasVoted', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChainId.mockReturnValue(1)
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 1,
    } as any)
  })

  it('should check if user has voted', () => {
    mockUseSmartContractRead.mockReturnValue({
      data: true,
    } as any)

    const { result } = renderHook(() => useHasVoted(1, mockAddress as any))
    expect(result.current.hasVoted).toBe(true)
  })

  it('should use current account address if none provided', () => {
    mockUseSmartContractRead.mockReturnValue({
      data: false,
    } as any)

    const { result } = renderHook(() => useHasVoted(1))
    expect(result.current.hasVoted).toBe(false)
  })
})

describe('Utility Functions', () => {
  describe('getProposalTypeConfig', () => {
    it('should return correct config for valid type', () => {
      const config = getProposalTypeConfig(1)
      expect(config).toEqual({
        id: 1,
        name: "Update Max Transfer",
        description: "Change the maximum transfer amount limit",
        requiresValue: true,
        requiresRecipients: false,
      })
    })

    it('should return undefined for invalid type', () => {
      const config = getProposalTypeConfig(999)
      expect(config).toBeUndefined()
    })
  })

  describe('getProposalStatus', () => {
    const mockProposal = {
      id: 1,
      creator: mockAddress as any,
      token: mockAddress as any,
      description: 'Test',
      votesFor: BigInt(1000),
      votesAgainst: BigInt(500),
      endTime: BigInt(Date.now() / 1000 + 86400),
      executed: false,
      active: true,
      proposalType: 1,
      proposedValue: BigInt(0),
      recipients: [],
      amounts: [],
    }

    it('should return executed for executed proposals', () => {
      const status = getProposalStatus({ ...mockProposal, executed: true })
      expect(status).toBe('executed')
    })

    it('should return active for active proposals', () => {
      const status = getProposalStatus(mockProposal)
      expect(status).toBe('active')
    })

    it('should return passed for proposals with majority votes after end time', () => {
      const expiredProposal = {
        ...mockProposal,
        endTime: BigInt(Date.now() / 1000 - 86400), // 1 day ago
        votesFor: BigInt(1000),
        votesAgainst: BigInt(500),
      }
      const status = getProposalStatus(expiredProposal)
      expect(status).toBe('passed')
    })

    it('should return expired for proposals without majority votes after end time', () => {
      const expiredProposal = {
        ...mockProposal,
        endTime: BigInt(Date.now() / 1000 - 86400), // 1 day ago
        votesFor: BigInt(500),
        votesAgainst: BigInt(1000),
      }
      const status = getProposalStatus(expiredProposal)
      expect(status).toBe('expired')
    })
  })

  describe('getTimeRemaining', () => {
    it('should return formatted time for future timestamps', () => {
      const futureTime = BigInt(Date.now() / 1000 + 2 * 24 * 60 * 60 + 5 * 60 * 60 + 30 * 60) // 2 days, 5 hours, 30 minutes
      const result = getTimeRemaining(futureTime)
      expect(result).toMatch(/\d+d \d+h remaining/)
    })

    it('should return hours and minutes for shorter periods', () => {
      const futureTime = BigInt(Date.now() / 1000 + 5 * 60 * 60 + 30 * 60) // 5 hours, 30 minutes
      const result = getTimeRemaining(futureTime)
      expect(result).toMatch(/\d+h \d+m remaining/)
    })

    it('should return minutes for very short periods', () => {
      const futureTime = BigInt(Date.now() / 1000 + 30 * 60) // 30 minutes
      const result = getTimeRemaining(futureTime)
      expect(result).toMatch(/\d+m remaining/)
    })

    it('should return "Ended" for past timestamps', () => {
      const pastTime = BigInt(Date.now() / 1000 - 86400) // 1 day ago
      const result = getTimeRemaining(pastTime)
      expect(result).toBe('Ended')
    })
  })

  describe('PROPOSAL_TYPES', () => {
    it('should have all expected proposal types', () => {
      expect(PROPOSAL_TYPES).toHaveLength(4)
      expect(PROPOSAL_TYPES.map(t => t.id)).toEqual([1, 2, 3, 4])
      expect(PROPOSAL_TYPES.map(t => t.name)).toEqual([
        "Update Max Transfer",
        "Update Max Holding",
        "Toggle Transfer Limits",
        "Execute Airdrop"
      ])
    })

    it('should have correct requirements for each type', () => {
      expect(PROPOSAL_TYPES[0].requiresValue).toBe(true) // Update Max Transfer
      expect(PROPOSAL_TYPES[0].requiresRecipients).toBe(false)
      
      expect(PROPOSAL_TYPES[1].requiresValue).toBe(true) // Update Max Holding
      expect(PROPOSAL_TYPES[1].requiresRecipients).toBe(false)
      
      expect(PROPOSAL_TYPES[2].requiresValue).toBe(false) // Toggle Transfer Limits
      expect(PROPOSAL_TYPES[2].requiresRecipients).toBe(false)
      
      expect(PROPOSAL_TYPES[3].requiresValue).toBe(false) // Execute Airdrop
      expect(PROPOSAL_TYPES[3].requiresRecipients).toBe(true)
    })
  })
})
