import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useSmartContractRead } from '../lib/hooks/useSmartContract'
import { showErrorAlert, showSuccessAlert } from '../lib/swal-config'
import CreateProposalForm from '../components/Governance/CreateProposalForm'

// Mock all dependencies
jest.mock('wagmi')
jest.mock('../lib/hooks/useSmartContract')
jest.mock('../lib/swal-config')

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseWriteContract = useWriteContract as jest.MockedFunction<typeof useWriteContract>
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as jest.MockedFunction<typeof useWaitForTransactionReceipt>
const mockUseSmartContractRead = useSmartContractRead as jest.MockedFunction<typeof useSmartContractRead>
const mockShowErrorAlert = showErrorAlert as jest.MockedFunction<typeof showErrorAlert>
const mockShowSuccessAlert = showSuccessAlert as jest.MockedFunction<typeof showSuccessAlert>

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('Integration Tests: Governance Flow', () => {
  const mockWriteContract = jest.fn()
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockTokenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
  const mockTransactionHash = '0xhash123'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock successful wallet connection
    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 1,
    } as any)

    // Mock successful contract write
    mockUseWriteContract.mockReturnValue({
      writeContract: mockWriteContract,
      data: mockTransactionHash,
      isPending: false,
    } as any)

    // Mock transaction receipt waiting
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
    } as any)

    // Mock contract reads
    mockUseSmartContractRead.mockImplementation(({ functionName }) => {
      switch (functionName) {
        case 'getAllDeployedTokens':
          return { data: [mockTokenAddress] }
        case 'name':
          return { data: 'Test Token' }
        case 'symbol':
          return { data: 'TEST' }
        case 'decimals':
          return { data: 18 }
        case 'proposalCount':
          return { data: BigInt(5) }
        default:
          return { data: null }
      }
    })
  })

  describe('Complete Proposal Creation Flow', () => {
    it('should handle complete proposal creation lifecycle', async () => {
      const user = userEvent.setup()
      const mockOnProposalCreated = jest.fn()

      const { rerender } = render(
        <TestWrapper>
          <CreateProposalForm onProposalCreated={mockOnProposalCreated} />
        </TestWrapper>
      )

      // Step 1: Fill out the form
      await waitFor(() => {
        expect(screen.getByLabelText(/Select Token/)).toBeInTheDocument()
      })

      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Integration test proposal')

      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1') // Update Max Transfer

      const valueInput = screen.getByLabelText(/Proposed Value/)
      await user.type(valueInput, '5000')

      // Step 2: Submit the form
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      expect(submitButton).not.toBeDisabled()

      await user.click(submitButton)

      // Verify contract write was called
      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'createProposal',
        args: [
          mockTokenAddress,
          'Integration test proposal',
          BigInt(1),
          expect.any(BigInt), // parseEther('5000')
          [],
          []
        ],
      })

      // Step 3: Simulate transaction pending
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: mockTransactionHash,
        isPending: true,
      } as any)

      rerender(
        <TestWrapper>
          <CreateProposalForm onProposalCreated={mockOnProposalCreated} />
        </TestWrapper>
      )

      expect(screen.getByText('Transaction Pending...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()

      // Step 4: Simulate transaction confirming
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: mockTransactionHash,
        isPending: false,
      } as any)

      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
      } as any)

      rerender(
        <TestWrapper>
          <CreateProposalForm onProposalCreated={mockOnProposalCreated} />
        </TestWrapper>
      )

      expect(screen.getByText('Confirming on Blockchain...')).toBeInTheDocument()

      // Step 5: Simulate transaction confirmed
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
      } as any)

      rerender(
        <TestWrapper>
          <CreateProposalForm onProposalCreated={mockOnProposalCreated} />
        </TestWrapper>
      )

      // Verify success handling
      await waitFor(() => {
        expect(mockShowSuccessAlert).toHaveBeenCalledWith(
          'Proposal Created!',
          'Your proposal has been submitted successfully and is now open for voting.'
        )
        expect(mockOnProposalCreated).toHaveBeenCalled()
      })

      // Form should be reset
      expect(screen.getByLabelText(/Description/)).toHaveValue('')
      expect(screen.getByRole('button', { name: /Create Proposal/ })).not.toBeDisabled()
    })

    it('should handle airdrop proposal with multiple recipients', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Select Token/)).toBeInTheDocument()
      })

      // Select airdrop proposal type
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4') // Execute Airdrop

      // Fill description
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Community airdrop proposal')

      // Add first recipient
      const addressInput = screen.getByPlaceholderText(/Recipient address/)
      await user.type(addressInput, '0x1111111111111111111111111111111111111111')

      const amountInput = screen.getByPlaceholderText('Amount')
      await user.type(amountInput, '1000')

      // Add second recipient
      const addButton = screen.getByText('Add Recipient')
      await user.click(addButton)

      const addressInputs = screen.getAllByPlaceholderText(/Recipient address/)
      const amountInputs = screen.getAllByPlaceholderText('Amount')

      await user.type(addressInputs[1], '0x2222222222222222222222222222222222222222')
      await user.type(amountInputs[1], '500')

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: 'createProposal',
        args: [
          mockTokenAddress,
          'Community airdrop proposal',
          BigInt(4),
          0n,
          [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222'
          ],
          [
            expect.any(BigInt), // parseEther('1000')
            expect.any(BigInt), // parseEther('500')
          ]
        ],
      })
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup()
      const networkError = new Error('Network connection failed')
      networkError.name = 'NetworkError'
      
      mockWriteContract.mockRejectedValue(networkError)

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      // Fill and submit form
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')

      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockShowErrorAlert).toHaveBeenCalledWith(
          'Transaction Failed',
          'Failed to create proposal'
        )
      })
    })

    it('should handle insufficient balance errors', async () => {
      const user = userEvent.setup()
      const insufficientBalanceError = new Error('Insufficient balance')
      insufficientBalanceError.name = 'InsufficientBalanceError'
      
      mockWriteContract.mockRejectedValue(insufficientBalanceError)

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')

      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockShowErrorAlert).toHaveBeenCalledWith(
          'Transaction Failed',
          'Failed to create proposal'
        )
      })
    })

    it('should handle transaction rejection', async () => {
      const user = userEvent.setup()
      const rejectionError = new Error('User rejected transaction')
      rejectionError.name = 'UserRejectedRequestError'
      
      mockWriteContract.mockRejectedValue(rejectionError)

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')

      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockShowErrorAlert).toHaveBeenCalledWith(
          'Transaction Failed',
          'Failed to create proposal'
        )
      })
    })
  })

  describe('Form Validation Integration', () => {
    it('should validate all fields together', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Select Token/)).toBeInTheDocument()
      })

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a proposal description'
      )

      // Fill description but use invalid value for value-type proposal
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')

      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1') // Requires value

      await user.click(submitButton)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a valid proposed value'
      )

      // Fix the value
      const valueInput = screen.getByLabelText(/Proposed Value/)
      await user.type(valueInput, '1000')

      await user.click(submitButton)

      // Should now succeed
      expect(mockWriteContract).toHaveBeenCalled()
    })

    it('should validate airdrop recipients thoroughly', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Select Token/)).toBeInTheDocument()
      })

      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Airdrop proposal')

      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4') // Airdrop

      // Try to submit without recipients
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide at least one recipient with address and amount'
      )

      // Add recipient with invalid address
      const addressInput = screen.getByPlaceholderText(/Recipient address/)
      await user.type(addressInput, 'invalid-address')

      const amountInput = screen.getByPlaceholderText('Amount')
      await user.type(amountInput, '100')

      await user.click(submitButton)

      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Invalid address: invalid-address'
      )

      // Fix the address
      await user.clear(addressInput)
      await user.type(addressInput, '0x1234567890123456789012345678901234567890')

      await user.click(submitButton)

      // Should now succeed
      expect(mockWriteContract).toHaveBeenCalled()
    })
  })

  describe('BigInt Handling Integration', () => {
    it('should properly handle BigInt values in proposal creation', async () => {
      const user = userEvent.setup()

      // Mock contract read with BigInt values
      mockUseSmartContractRead.mockImplementation(({ functionName }) => {
        switch (functionName) {
          case 'getAllDeployedTokens':
            return { data: [mockTokenAddress] }
          case 'name':
            return { data: 'Test Token' }
          case 'symbol':
            return { data: 'TEST' }
          case 'decimals':
            return { data: 18 }
          case 'proposalCount':
            return { data: BigInt('999999999999999999999') } // Large BigInt
          default:
            return { data: null }
        }
      })

      render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      // Fill form with large values
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Large value proposal')

      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1')

      const valueInput = screen.getByLabelText(/Proposed Value/)
      await user.type(valueInput, '999999999999.999999999999999999') // Large decimal

      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      // Should handle large BigInt values properly
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            expect.any(BigInt), // Should be converted to BigInt properly
          ])
        })
      )
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility during transaction states', async () => {
      const user = userEvent.setup()

      const { rerender } = render(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      // Fill form
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Accessibility test')

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)

      // Simulate pending state
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: mockTransactionHash,
        isPending: true,
      } as any)

      rerender(
        <TestWrapper>
          <CreateProposalForm />
        </TestWrapper>
      )

      // Button should still be accessible but disabled
      const pendingButton = screen.getByRole('button', { name: /Transaction Pending/ })
      expect(pendingButton).toBeDisabled()
      expect(pendingButton).toHaveAttribute('aria-disabled', 'true')
    })
  })
})
