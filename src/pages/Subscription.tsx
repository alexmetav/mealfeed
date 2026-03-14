import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CheckCircle2, Loader2, Wallet, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Subscription() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'premium' | 'pro' | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [successAnimation, setSuccessAnimation] = useState(false);

  const handlePlanClick = (plan: 'free' | 'premium' | 'pro') => {
    if (plan === 'free') {
      handleUpgrade('free');
    } else {
      setSelectedPlan(plan);
      setShowWalletModal(true);
    }
  };

  const handleUpgrade = async (plan: 'free' | 'premium' | 'pro', walletAddress?: string, cycle: 'monthly' | 'yearly' = 'monthly') => {
    if (!user) return;
    setLoading(true);
    try {
      const updates: any = { subscriptionPlan: plan };
      
      if (plan !== 'free') {
        const expiresAt = new Date();
        if (cycle === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }
        updates.subscriptionExpiresAt = expiresAt.toISOString();
        if (walletAddress) {
          updates.walletAddress = walletAddress;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      throw error;
    } finally {
      setLoading(false);
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (switchError: any) {
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
        
        currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== BNB_CHAIN_ID) {
          throw new Error("Wallet is still on the wrong network. Please switch to BNB Smart Chain manually.");
        }
      }

      // Calculate amount based on plan and cycle
      // Monthly: Premium ~0.16 BNB, Pro ~0.33 BNB
      // Yearly: Premium ~1.6 BNB, Pro ~2.6 BNB (Approximate values for $499 and $799)
      let amountHex = '0x0';
      if (billingCycle === 'monthly') {
        amountHex = selectedPlan === 'premium' ? '0x2386F26FC100000' : '0x49539EE04100000'; // 0.16 BNB, 0.33 BNB
      } else {
        amountHex = selectedPlan === 'premium' ? '0x16345785D8A00000' : '0x2417242171E00000'; // 1.6 BNB, 2.6 BNB
      }

      // Request transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: '0x952B778a4A48Fa90406bFb8a53Fd415c188EbcEd',
          value: amountHex,
        }],
      });
      
      // Wait for transaction confirmation
      let receipt = null;
      while (receipt === null) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        receipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
      }

      if (receipt.status !== '0x1') {
        throw new Error("Transaction failed on the blockchain.");
      }

      // Verify transaction amount
      const tx = await window.ethereum.request({
        method: 'eth_getTransactionByHash',
        params: [txHash],
      });

      if (tx.value !== amountHex) {
         throw new Error("Transaction amount mismatch.");
      }
      
      if (selectedPlan) {
        await handleUpgrade(selectedPlan, address, billingCycle);
        setShowWalletModal(false);
        setSuccessAnimation(true);
        setTimeout(() => {
          setSuccessAnimation(false);
          window.location.reload();
        }, 4000);
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Transaction failed or rejected.");
      setLoading(false);
    }
  };

  const isSubscriptionActive = profile?.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) > new Date();

  return (
    <div className="max-w-5xl mx-auto pb-24 relative font-sans">
      {successAnimation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="bg-white dark:bg-[#1c1c1e] p-10 rounded-[3rem] flex flex-col items-center justify-center text-center shadow-2xl shadow-orange-500/20 transform animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">You are Subscribed!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-6">Welcome to the {selectedPlan} plan.</p>
            <div className="flex items-center gap-2 text-orange-500 font-medium bg-orange-500/10 px-6 py-3 rounded-full border border-orange-500/20">
              <Sparkles className="w-5 h-5" />
              Enjoy your premium features
            </div>
          </div>
        </div>
      )}

      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-3">Manage Subscription</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">Choose the plan that fits your health journey.</p>
        </div>
        
        <div className="flex items-center bg-zinc-200 dark:bg-white/5 p-1 rounded-full border border-zinc-300 dark:border-white/10 w-fit">
          <button 
            onClick={() => setBillingCycle('monthly')}
            className={clsx(
              "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
              billingCycle === 'monthly' ? "bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Monthly
          </button>
          <button 
            onClick={() => setBillingCycle('yearly')}
            className={clsx(
              "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
              billingCycle === 'yearly' ? "bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            Yearly <span className="text-[10px] text-orange-500 uppercase tracking-wider ml-1">Save 20%</span>
          </button>
        </div>
      </div>

      {isSubscriptionActive && profile.subscriptionPlan !== 'free' && (
        <div className="mb-10 p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl text-orange-400 flex items-center gap-4 shadow-lg shadow-orange-500/5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">Active Subscription via Web3</p>
            <p className="text-sm opacity-80 mt-0.5">
              Expires on: {new Date(profile.subscriptionExpiresAt!).toLocaleDateString()}
              {profile.walletAddress && ` • Wallet: ${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { id: 'free', name: 'Free', priceMonthly: '$0', priceYearly: '$0', features: ['Upload food photos', 'Browse feed', 'Like & comment', 'Save posts'] },
          { id: 'premium', name: 'Premium', priceMonthly: '$49', priceYearly: '$499', features: ['Profile customization', 'Premium glowing badge', 'Direct DM inbox', 'Basic health score'], popular: true },
          { id: 'pro', name: 'Pro', priceMonthly: '$99', priceYearly: '$799', features: ['Health assistant', 'Weekly health reports', 'Advanced health insights', 'Personalized diet recommendations'] },
        ].map((plan) => (
          <div key={plan.id} className={clsx(
            "p-8 rounded-[2rem] border flex flex-col relative transition-all duration-300 hover:scale-[1.02]",
            plan.popular ? "bg-white dark:bg-[#1c1c1e] border-orange-500/50 shadow-2xl shadow-orange-900/20" : "bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 backdrop-blur-xl",
            profile?.subscriptionPlan === plan.id && isSubscriptionActive && "ring-2 ring-orange-500"
          )}>
            {profile?.subscriptionPlan === plan.id && isSubscriptionActive && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-500/20">
                <CheckCircle2 className="w-4 h-4" /> Current Plan
              </span>
            )}
            <h3 className="text-2xl font-semibold mb-2 tracking-tight">{plan.name}</h3>
            <div className="text-5xl font-bold mb-8 tracking-tighter">
              {billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}
              <span className="text-xl text-zinc-500 font-medium tracking-normal">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
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
              disabled={loading || (profile?.subscriptionPlan === plan.id && isSubscriptionActive)}
              className={clsx(
                "w-full py-4 rounded-2xl font-semibold transition-all duration-300 disabled:opacity-50",
                plan.popular ? "bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/30" : "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-white/20"
              )}
            >
              {loading && profile?.subscriptionPlan !== plan.id ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (profile?.subscriptionPlan === plan.id && isSubscriptionActive) ? 'Current Plan' : 'Select Plan'}
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
              Connect your Web3 wallet to pay for the <span className="text-orange-400 font-medium capitalize">{selectedPlan}</span> plan on BNB Smart Chain.
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
                  <span className="font-medium text-zinc-900 dark:text-white">MetaMask (BNB Chain)</span>
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
