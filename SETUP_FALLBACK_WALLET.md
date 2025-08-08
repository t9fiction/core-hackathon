# Fallback Wallet Setup Guide

## Quick Setup

### 1. Configure Environment Variable

Add the fallback wallet private key to your `.env` file:

```bash
# Copy .env.example to .env if you haven't already
cp .env.example .env

# Edit .env and add your private key (without 0x prefix)
NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY=your_private_key_here
```

### 2. Start Development Server

```bash
npm run dev
```

The app will now show live token data even without wallet connection!

## Security Checklist

- [ ] ✅ Private key is in `.env` file (not hardcoded in source)
- [ ] ✅ Private key does NOT include `0x` prefix in env file
- [ ] ✅ Fallback wallet contains only minimal funds (for gas if needed)
- [ ] ✅ Never use a wallet with valuable assets
- [ ] ✅ `.env` file is in `.gitignore` (already done)

## Testing the Implementation

### Without Wallet Connected:
1. Visit `http://localhost:3001`
2. You should see:
   - ✅ "Using Public View" status indicator
   - ✅ Informational banner about public data mode
   - ✅ Live token listings (if any tokens are deployed)
   - ✅ Token information and prices

### With Wallet Connected:
1. Click "Connect Wallet" 
2. Connect your wallet
3. Status indicator changes to "Wallet Connected"
4. Full trading functionality becomes available

## Troubleshooting

### "Fallback wallet not configured" Error
- Check that `NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY` is set in `.env`
- Ensure the private key is valid (64 characters, hex)
- Restart the development server after changing `.env`

### No Token Data Showing
- Ensure there are deployed tokens in your factory contract
- Check browser console for any RPC connection errors
- Verify the fallback wallet can connect to your configured blockchain

### RPC Rate Limiting
- Consider using a premium RPC endpoint
- The fallback wallet might hit rate limits with public RPCs
- You can add multiple fallback wallets to distribute load

## Environment Variables Reference

```bash
# Required: RainbowKit project ID
reown_api=your_project_id

# Required: Fallback wallet private key (no 0x prefix)
NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY=your_key

# Optional: Enable testnets
NEXT_PUBLIC_ENABLE_TESTNETS=true
```

## Production Deployment

For production deployments:

1. **Use a dedicated production fallback wallet**
2. **Ensure proper environment variable setup on your hosting platform**
3. **Consider using different keys per environment**
4. **Monitor RPC usage and costs**

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify environment variable configuration
3. Test with a fresh private key
4. Ensure your RPC endpoints are working

---

Your app now provides a seamless experience for users whether they have a wallet connected or not! 🎉
