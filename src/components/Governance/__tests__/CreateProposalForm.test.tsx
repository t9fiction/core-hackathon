import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAccount } from 'wagmi'
import { useGovernance, PROPOSAL_TYPES } from '../../../lib/hooks/useGovernance'
import { useSmartContractRead } from '../../../lib/hooks/useSmartContract'
import { showErrorAlert, showSuccessAlert } from '../../../lib/swal-config'
import CreateProposalForm from '../CreateProposalForm'

// Mock dependencies
jest.mock('wagmi')
jest.mock('../../../lib/hooks/useGovernance')
jest.mock('../../../lib/hooks/useSmartContract')
jest.mock('../../../lib/swal-config')

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseGovernance = useGovernance as jest.MockedFunction<typeof useGovernance>
const mockUseSmartContractRead = useSmartContractRead as jest.MockedFunction<typeof useSmartContractRead>
const mockShowErrorAlert = showErrorAlert as jest.MockedFunction<typeof showErrorAlert>
const mockShowSuccessAlert = showSuccessAlert as jest.MockedFunction<typeof showSuccessAlert>

describe('CreateProposalForm', () => {
  const mockCreateProposal = jest.fn()
  const mockOnProposalCreated = jest.fn()
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockTokenAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef'

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAccount.mockReturnValue({
      address: mockAddress,
      isConnected: true,
      chainId: 1,
    } as any)

    mockUseGovernance.mockReturnValue({
      createProposal: mockCreateProposal,
      isPending: false,
      isConfirming: false,
      isConfirmed: false,
      transactionHash: null,
    } as any)

    // Mock token list
    mockUseSmartContractRead.mockImplementation(({ functionName }) => {
      if (functionName === 'getAllDeployedTokens') {
        return { data: [mockTokenAddress] }
      }
      if (functionName === 'name') {
        return { data: 'Test Token' }
      }
      if (functionName === 'symbol') {
        return { data: 'TEST' }
      }
      if (functionName === 'decimals') {
        return { data: 18 }
      }
      return { data: null }
    })
  })

  describe('Wallet Connection', () => {
    it('should show connect wallet message when not connected', () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: 1,
      } as any)

      render(<CreateProposalForm />)
      
      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
      expect(screen.getByText('Please connect your wallet to create governance proposals')).toBeInTheDocument()
    })

    it('should show form when connected', () => {
      render(<CreateProposalForm />)
      
      expect(screen.getByText('Create New Proposal')).toBeInTheDocument()
      expect(screen.getByLabelText(/Select Token/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Proposal Type/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    })
  })

  describe('Form Elements', () => {
    beforeEach(() => {
      render(<CreateProposalForm onProposalCreated={mockOnProposalCreated} />)
    })

    it('should render all proposal types', () => {
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      
      PROPOSAL_TYPES.forEach(type => {
        expect(screen.getByRole('option', { name: type.name })).toBeInTheDocument()
      })
    })

    it('should show token selector with available tokens', () => {
      const tokenSelect = screen.getByLabelText(/Select Token/)
      expect(tokenSelect).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockTokenAddress)).toBeInTheDocument()
    })

    it('should show description textarea', () => {
      const descriptionTextarea = screen.getByLabelText(/Description/)
      expect(descriptionTextarea).toBeInTheDocument()
      expect(descriptionTextarea).toHaveAttribute('placeholder', expect.stringContaining('Describe your proposal'))
    })

    it('should show character counter for description', () => {
      const descriptionTextarea = screen.getByLabelText(/Description/)
      fireEvent.change(descriptionTextarea, { target: { value: 'Test description' } })
      
      expect(screen.getByText('16/500 characters')).toBeInTheDocument()
    })
  })

  describe('Conditional Form Fields', () => {
    it('should show proposed value field for value-requiring proposal types', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1') // Update Max Transfer
      
      expect(screen.getByLabelText(/Proposed Value/)).toBeInTheDocument()
    })

    it('should not show proposed value field for non-value proposal types', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '3') // Toggle Transfer Limits
      
      expect(screen.queryByLabelText(/Proposed Value/)).not.toBeInTheDocument()
    })

    it('should show airdrop recipients for airdrop proposal type', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4') // Execute Airdrop
      
      expect(screen.getByLabelText(/Airdrop Recipients/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Recipient address/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument()
    })

    it('should add and remove airdrop recipients', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4') // Execute Airdrop
      
      // Add recipient
      const addButton = screen.getByText('Add Recipient')
      await user.click(addButton)
      
      const recipientInputs = screen.getAllByPlaceholderText(/Recipient address/)
      expect(recipientInputs).toHaveLength(2)
      
      // Remove recipient
      const removeButtons = screen.getAllByText('×')
      await user.click(removeButtons[0])
      
      const remainingInputs = screen.getAllByPlaceholderText(/Recipient address/)
      expect(remainingInputs).toHaveLength(1)
    })
  })

  describe('Form Validation', () => {
    it('should validate empty description', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a proposal description'
      )
      expect(mockCreateProposal).not.toHaveBeenCalled()
    })

    it('should validate invalid proposed value', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      // Select proposal type that requires value
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1')
      
      // Fill description but leave value empty
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide a valid proposed value'
      )
    })

    it('should validate airdrop recipients', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      // Select airdrop proposal type
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4')
      
      // Fill description
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test airdrop proposal')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Please provide at least one recipient with address and amount'
      )
    })

    it('should validate invalid recipient addresses', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      // Select airdrop proposal type
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4')
      
      // Fill form with invalid address
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test airdrop proposal')
      
      const addressInput = screen.getByPlaceholderText(/Recipient address/)
      await user.type(addressInput, 'invalid-address')
      
      const amountInput = screen.getByPlaceholderText('Amount')
      await user.type(amountInput, '100')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        'Invalid Input',
        'Invalid address: invalid-address'
      )
    })
  })

  describe('Form Submission', () => {
    it('should submit valid proposal successfully', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm onProposalCreated={mockOnProposalCreated} />)
      
      // Fill form
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')
      
      // Select proposal type that requires value
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '1')
      
      const valueInput = screen.getByLabelText(/Proposed Value/)
      await user.type(valueInput, '1000')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockTokenAddress,
        'Test proposal',
        1,
        expect.any(BigInt),
        [],
        []
      )
    })

    it('should submit airdrop proposal with recipients', async () => {
      const user = userEvent.setup()
      render(<CreateProposalForm />)
      
      // Select airdrop proposal type
      const proposalTypeSelect = screen.getByLabelText(/Proposal Type/)
      await user.selectOptions(proposalTypeSelect, '4')
      
      // Fill form
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test airdrop proposal')
      
      const addressInput = screen.getByPlaceholderText(/Recipient address/)
      await user.type(addressInput, mockAddress)
      
      const amountInput = screen.getByPlaceholderText('Amount')
      await user.type(amountInput, '100')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      expect(mockCreateProposal).toHaveBeenCalledWith(
        mockTokenAddress,
        'Test airdrop proposal',
        4,
        0n,
        [mockAddress],
        [expect.any(BigInt)]
      )
    })
  })

  describe('Transaction States', () => {
    it('should show different button states during transaction', () => {
      // Test confirming state
      mockUseGovernance.mockReturnValue({
        createProposal: mockCreateProposal,
        isPending: false,
        isConfirming: true,
        isConfirmed: false,
        transactionHash: 'hash123',
      } as any)

      render(<CreateProposalForm />)
      
      const submitButton = screen.getByRole('button', { name: /Confirming on Blockchain/ })
      expect(submitButton).toBeDisabled()
      expect(screen.getByText('Confirming on Blockchain...')).toBeInTheDocument()
    })

    it('should show pending state', () => {
      mockUseGovernance.mockReturnValue({
        createProposal: mockCreateProposal,
        isPending: true,
        isConfirming: false,
        isConfirmed: false,
        transactionHash: 'hash123',
      } as any)

      render(<CreateProposalForm />)
      
      const submitButton = screen.getByRole('button', { name: /Transaction Pending/ })
      expect(submitButton).toBeDisabled()
      expect(screen.getByText('Transaction Pending...')).toBeInTheDocument()
    })
  })

  describe('Success Handling', () => {
    it('should show success alert and reset form when transaction is confirmed', () => {
      const { rerender } = render(<CreateProposalForm onProposalCreated={mockOnProposalCreated} />)
      
      // Simulate transaction confirmation
      mockUseGovernance.mockReturnValue({
        createProposal: mockCreateProposal,
        isPending: false,
        isConfirming: false,
        isConfirmed: true,
        transactionHash: 'hash123',
      } as any)

      // Re-render with confirmed state
      rerender(<CreateProposalForm onProposalCreated={mockOnProposalCreated} />)

      expect(mockShowSuccessAlert).toHaveBeenCalledWith(
        'Proposal Created!',
        'Your proposal has been submitted successfully and is now open for voting.'
      )
      expect(mockOnProposalCreated).toHaveBeenCalled()
    })
  })

  describe('Token Information', () => {
    it('should display token name and symbol when available', async () => {
      render(<CreateProposalForm />)
      
      await waitFor(() => {
        expect(screen.getByText(/Selected: Test Token \(TEST\)/)).toBeInTheDocument()
      })
    })

    it('should auto-select first token when tokens are loaded', () => {
      render(<CreateProposalForm />)
      
      const tokenSelect = screen.getByLabelText(/Select Token/)
      expect(tokenSelect).toHaveValue(mockTokenAddress)
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<CreateProposalForm />)
      
      expect(screen.getByLabelText(/Select Token \*/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Proposal Type \*/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Description \*/)).toBeInTheDocument()
    })

    it('should have proper button roles', () => {
      render(<CreateProposalForm />)
      
      expect(screen.getByRole('button', { name: /Create Proposal/ })).toBeInTheDocument()
    })

    it('should have proper form structure', () => {
      render(<CreateProposalForm />)
      
      expect(screen.getByRole('form')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle createProposal errors gracefully', async () => {
      const user = userEvent.setup()
      mockCreateProposal.mockRejectedValue(new Error('Transaction failed'))
      
      render(<CreateProposalForm />)
      
      // Fill and submit form
      const descriptionTextarea = screen.getByLabelText(/Description/)
      await user.type(descriptionTextarea, 'Test proposal')
      
      const submitButton = screen.getByRole('button', { name: /Create Proposal/ })
      await user.click(submitButton)
      
      // Should not crash and should handle error gracefully
      expect(mockCreateProposal).toHaveBeenCalled()
    })
  })
})
