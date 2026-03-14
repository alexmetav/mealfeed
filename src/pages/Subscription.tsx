import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CheckCircle2, Loader2, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import clsx from 'clsx';

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
  }
}

export default function Subscription() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'pro' | null>(null);

  const handlePlanClick = (plan: 'free' | 'premium' | 'pro') => {
    if (plan === 'free') {
      handleUpgrade('free');
    } else {
      setSelectedPlan(plan);
      setShowWalletModal(true);
    }
  };

  const handleUpgrade = async (plan: 'free' | 'premium' | 'pro', walletAddress?: string) => {
    if (!user || profile?.subscriptionPlan === plan) return;
    setLoading(true);
    try {
      const updates: any = { subscriptionPlan: plan };
      
      if (plan !== 'free') {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        updates.subscriptionExpiresAt = expiresAt.toISOString();
        if (walletAddress) {
          updates.walletAddress = walletAddress;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), updates);
      alert(`Successfully upgraded to ${plan} plan!`);
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
      setShowWalletModal(false);
    }
  };

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert("MetaMask extension not found. Please install it.");
      return;
    }
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      // Switch to BNB Smart Chain
      const BNB_CHAIN_ID = '0x38';
      let currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (currentChainId !== BNB_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BNB_CHAIN_ID }],
          });
          // Small delay to allow provider state to settle
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (switchError: any) {
          // 4902: Chain not added, -32603: Internal error (often means chain not added in some wallets)
          if (switchError.code === 4902 || switchError.code === -32603) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BNB_CHAIN_ID,
                  chainName: 'BNB Smart Chain',
                  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                  rpcUrls: ['https://bsc-dataseed.binance.org/'],
                  blockExplorerUrls: ['https://bscscan.com/']
                }],
              });
              // Small delay after adding and switching
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (addError: any) {
              if (addError.code === 4001) {
                throw new Error("Please accept the request to add BNB Smart Chain to your wallet.");
              }
              throw new Error("Failed to add BNB Smart Chain. Please add it manually in MetaMask.");
            }
          } else if (switchError.code === 4001) {
            throw new Error("Please switch to BNB Smart Chain to continue.");
          } else if (switchError.code === -32002) {
            throw new Error("A network switch request is already pending in your wallet. Please check MetaMask.");
          } else {
            throw switchError;
          }
        }
        
        // Final verification of the chain ID
        currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== BNB_CHAIN_ID) {
          throw new Error("Wallet is still on the wrong network. Please switch to BNB Smart Chain manually.");
        }
      }

      // Premium: ~0.16 BNB, Pro: ~0.33 BNB
      const amountHex = selectedPlan === 'premium' ? '0x2386F26FC100000' : '0x49539EE04100000';

      // Request transaction
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: '0x952B778a4A48Fa90406bFb8a53Fd415c188EbcEd', // Subscription receiver
          value: amountHex,
        }],
      });
      
      if (selectedPlan) {
        await handleUpgrade(selectedPlan, address);
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Transaction failed or rejected.");
      setLoading(false);
    }
  };

  const connectPhantom = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      alert("Phantom extension not found. Please install it.");
      return;
    }
    try {
      setLoading(true);
      const resp = await window.solana.connect();
      const address = resp.publicKey.toString();
      
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const amountSol = selectedPlan === 'premium' ? 0.33 : 0.66;
      const lamports = amountSol * LAMPORTS_PER_SOL;

      const receiverPubKey = new PublicKey('EpV1n4qrHFKHiN1xV4H7r45DdPh6ZA3pHWLsVArBpkUH');

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: resp.publicKey,
          toPubkey: receiverPubKey,
          lamports: lamports,
        })
      );

      transaction.feePayer = resp.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      await window.solana.signAndSendTransaction(transaction);
      
      if (selectedPlan) {
        await handleUpgrade(selectedPlan, address);
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Transaction failed or rejected.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 relative font-sans">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-3">Manage Subscription</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">Choose the plan that fits your health journey.</p>
      </div>

      {profile?.subscriptionExpiresAt && profile.subscriptionPlan !== 'free' && (
        <div className="mb-10 p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl text-orange-400 flex items-center gap-4 shadow-lg shadow-orange-500/5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">Active Subscription via Web3</p>
            <p className="text-sm opacity-80 mt-0.5">
              Expires on: {new Date(profile.subscriptionExpiresAt).toLocaleDateString()}
              {profile.walletAddress && ` • Wallet: ${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { id: 'free', name: 'Free', price: '$0', features: ['Upload food photos', 'Browse feed', 'Like & comment', 'Save posts'] },
          { id: 'premium', name: 'Premium', price: '$49', features: ['Profile customization', 'Premium glowing badge', 'Direct DM inbox', 'Basic health score'], popular: true },
          { id: 'pro', name: 'Pro', price: '$99', features: ['Health assistant', 'Weekly health reports', 'Advanced health insights', 'Personalized diet recommendations'] },
        ].map((plan) => (
          <div key={plan.id} className={clsx(
            "p-8 rounded-[2rem] border flex flex-col relative transition-all duration-300 hover:scale-[1.02]",
            plan.popular ? "bg-white dark:bg-[#1c1c1e] border-orange-500/50 shadow-2xl shadow-orange-900/20" : "bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 backdrop-blur-xl",
            profile?.subscriptionPlan === plan.id && "ring-2 ring-orange-500"
          )}>
            {profile?.subscriptionPlan === plan.id && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-500/20">
                <CheckCircle2 className="w-4 h-4" /> Current Plan
              </span>
            )}
            <h3 className="text-2xl font-semibold mb-2 tracking-tight">{plan.name}</h3>
            <div className="text-5xl font-bold mb-8 tracking-tighter">{plan.price}<span className="text-xl text-zinc-500 font-medium tracking-normal">/mo</span></div>
            <ul className="space-y-4 mb-10 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  <span className="text-sm font-medium">{f}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handlePlanClick(plan.id as 'free' | 'premium' | 'pro')}
              disabled={loading || profile?.subscriptionPlan === plan.id}
              className={clsx(
                "w-full py-4 rounded-2xl font-semibold transition-all duration-300 disabled:opacity-50",
                plan.popular ? "bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/30" : "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-white/20"
              )}
            >
              {loading && profile?.subscriptionPlan !== plan.id ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : profile?.subscriptionPlan === plan.id ? 'Current Plan' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-50 dark:bg-black/60 backdrop-blur-2xl">
          <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] p-8 max-w-sm w-full relative shadow-2xl">
            <button 
              onClick={() => setShowWalletModal(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-900 dark:text-white transition-colors bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-semibold mb-2 tracking-tight">Connect Wallet</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
              Connect your Web3 wallet to pay for the <span className="text-orange-400 font-medium capitalize">{selectedPlan}</span> plan.
            </p>

            <div className="space-y-3">
              <button 
                onClick={connectMetaMask}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 hover:border-orange-500/50 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all duration-300 disabled:opacity-50 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-zinc-900 dark:text-white">MetaMask</span>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
              </button>

              <button 
                onClick={connectPhantom}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 hover:border-purple-500/50 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all duration-300 disabled:opacity-50 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/Phantom_icon.svg" alt="Phantom" className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-zinc-900 dark:text-white">Phantom</span>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
