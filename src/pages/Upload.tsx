import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, X, Loader2, CheckCircle2, AlertCircle, Camera, Image as ImageIcon, Lock } from 'lucide-react';
import clsx from 'clsx';
import { aiVision } from '../services/aiService';
import { checkSpam, logActivity } from '../services/spamService';

interface FoodAnalysisResult {
  isFood: boolean;
  foodType: string;
  category: string;
  healthRating: 'High' | 'Medium' | 'Low';
  healthScore: number;
  healthTips: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

import { usePoints } from '../context/PointsContext';

import { checkAndUpdateDailyLimit } from '../utils/dailyLimits';

export default function Upload() {
  const { user, profile, refreshProfile } = useAuth();
  const { showPoints } = usePoints();
  const navigate = useNavigate();
  
  const isSubscribed = profile?.subscriptionPlan === 'pro' || profile?.subscriptionPlan === 'premium' || profile?.role === 'admin';
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysisResult | null>(null);
  const [declineModal, setDeclineModal] = useState<{ show: boolean; attempts: number; isTimeout: boolean } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(100);
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      
      // Auto-capture after 3 seconds of "scanning"
      setTimeout(() => {
        capturePhoto(stream);
      }, 3500);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => {
        video.play().catch(err => console.error("Error playing video:", err));
      };
    }
  }, [isCameraActive, cameraStream]);

  const stopCamera = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraActive(false);
  };

  const capturePhoto = (stream: MediaStream) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Resize to max 800x800 for Firestore limits
    const MAX_WIDTH = 800;
    const MAX_HEIGHT = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      setMimeType('image/jpeg');
      stopCamera(stream);
      // Trigger analysis automatically
      setTimeout(() => {
        handleAnalyze(dataUrl);
      }, 100);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize image to fit in Firestore (max 1MB, let's aim for ~100KB)
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Fill with white background to prevent transparent PNG/WebP from turning black
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImage(dataUrl);
        setMimeType('image/jpeg');
      };
      img.onerror = () => {
        alert("Failed to load image. The file might be corrupted or unsupported.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      alert("Failed to read the file.");
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (autoImage?: string) => {
    const currentImage = autoImage || image;
    if (!currentImage || !user || !profile) return;

    // Check timeout
    if (profile.scanTimeoutUntil) {
      const timeoutDate = new Date(profile.scanTimeoutUntil);
      if (timeoutDate > new Date()) {
        setDeclineModal({ show: true, attempts: 3, isTimeout: true });
        return;
      }
    }

    setLoading(true);
    setIsAnalyzing(true);
    setError(null);
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const base64Data = currentImage.split(',')[1];
        
        const prompt = `Analyze this image. First, determine if it is a food item. Live animals or non-food objects should be marked as NOT food.
        Provide the following information:
        - isFood: boolean (true if it's food, false otherwise)
        - foodType: Name of the food (or "Not Food" if isFood is false)
        - category: Category like Breakfast, Lunch, Snack, etc. (or "None" if isFood is false)
        - healthRating: Must be exactly 'High', 'Medium', or 'Low' (or "Low" if isFood is false)
        - healthScore: Score from 0 to 100 (or 0 if isFood is false)
        - healthTips: Short health tip (or "Please scan correct food" if isFood is false)
        - calories: Estimated calories (or 0 if isFood is false)
        - protein: Estimated protein in grams (or 0 if isFood is false)
        - carbs: Estimated carbs in grams (or 0 if isFood is false)
        - fat: Estimated fat in grams (or 0 if isFood is false)`;

        const schema = {
          type: 'object',
          properties: {
            isFood: { type: 'boolean' },
            foodType: { type: 'string' },
            category: { type: 'string' },
            healthRating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
            healthScore: { type: 'number' },
            healthTips: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
          },
          required: ['isFood', 'foodType', 'category', 'healthRating', 'healthScore', 'healthTips', 'calories', 'protein', 'carbs', 'fat'],
        };

        const response = await aiVision(prompt, base64Data, mimeType, schema);

        if (response) {
          try {
            const cleanedText = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedResult = JSON.parse(cleanedText) as FoodAnalysisResult;
            
            if (!parsedResult.isFood) {
              const newFailedCount = (profile.failedScanCount || 0) + 1;
              const updates: any = {
                failedScanCount: newFailedCount
              };

              if (newFailedCount >= 3) {
                const timeoutUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                updates.scanTimeoutUntil = timeoutUntil;
                updates.failedScanCount = 0; // Reset after timeout is set
                setDeclineModal({ show: true, attempts: 3, isTimeout: true });
              } else {
                setDeclineModal({ show: true, attempts: newFailedCount, isTimeout: false });
              }

              await updateDoc(doc(db, 'users', user.uid), updates);
              await refreshProfile();
              setLoading(false);
              setIsAnalyzing(false);
              return;
            }

            // If it is food, reset failed count
            if (profile.failedScanCount && profile.failedScanCount > 0) {
              await updateDoc(doc(db, 'users', user.uid), {
                failedScanCount: 0
              });
              await refreshProfile();
            }

            setAnalysis(parsedResult);
            break; // Success, exit loop
          } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Text:", response);
            throw new Error("Failed to parse AI response format");
          }
        } else {
          throw new Error("Empty response from AI");
        }
      } catch (error: any) {
        console.error(`Analysis failed (retries left: ${retries}):`, error);
        if (retries === 0) {
          let errorMsg = error?.message || 'Unknown error';
          if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429')) {
            errorMsg = "AI Quota Exceeded. Please wait a minute.";
          }
          setError(errorMsg);
        }
        retries--;
        if (retries >= 0) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s before retry
        }
      }
    }
    setLoading(false);
    setIsAnalyzing(false);
  };

  const consumeQuota = (amount: number) => {
    setQuota(prev => {
      const next = prev - amount;
      if (next <= 0) {
        setIsQuotaLoading(true);
        setTimeout(() => {
          setQuota(100);
          setIsQuotaLoading(false);
        }, 3000); // Reset after 3 seconds for writes
        return 0;
      }
      return next;
    });
  };

  const handlePost = async () => {
    if (!user || !profile || !image || !analysis || isQuotaLoading) return;
    
    setLoading(true);
    setError(null);
    consumeQuota(25); // High cost for write operation

    try {
      // Anti-spam check
      const spamCheck = await checkSpam(user.uid, 'post', profile.spamTimeoutUntil);
      if (spamCheck.isSpam) {
        const remainingTime = new Date(spamCheck.timeoutUntil!).getTime() - Date.now();
        const hours = Math.ceil(remainingTime / (1000 * 60 * 60));
        alert(`Spam activity detected. Your account is timed out for ${hours} more hours.`);
        setLoading(false);
        return;
      }

      // Normalize analysis data to ensure correct types for Firestore rules
      const normalizedAnalysis = {
        ...analysis,
        foodType: analysis.foodType || 'Unknown Food',
        category: analysis.category || 'Other',
        healthRating: (analysis.healthRating === 'High' || analysis.healthRating === 'Medium' || analysis.healthRating === 'Low') 
          ? analysis.healthRating 
          : 'Medium', // Fallback to Medium if AI returns invalid rating
        healthScore: Number(analysis.healthScore) || 0,
        calories: Number(analysis.calories) || 0,
        protein: Number(analysis.protein) || 0,
        carbs: Number(analysis.carbs) || 0,
        fat: Number(analysis.fat) || 0,
      };

      const postRef = doc(collection(db, 'posts'));
      await setDoc(postRef, {
        userId: user.uid,
        authorName: profile.username || profile.displayName || 'User',
        authorImage: profile.profileImage || '',
        authorIsCreator: profile.isCreator || false,
        imageUrl: image,
        foodType: normalizedAnalysis.foodType,
        category: normalizedAnalysis.category,
        healthRating: normalizedAnalysis.healthRating,
        healthScore: normalizedAnalysis.healthScore,
        calories: normalizedAnalysis.calories,
        protein: normalizedAnalysis.protein,
        carbs: normalizedAnalysis.carbs,
        fat: normalizedAnalysis.fat,
        caption,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });
      
      // Log activity for spam detection
      await logActivity(user.uid, 'post');
      
      // Check daily limit and reward points
      const canEarnPoints = await checkAndUpdateDailyLimit(user.uid, profile, 'POSTS');
      
      if (canEarnPoints) {
        const pointsToEarn = profile.isCreator ? 200 : 100;
        showPoints(pointsToEarn, 'Meal Shared');
        await updateDoc(doc(db, 'users', user.uid), {
          points: increment(pointsToEarn),
          postsCount: increment(1)
        });
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          postsCount: increment(1)
        });
      }
      
      await refreshProfile();
      navigate('/dashboard');
    } catch (error) {
      console.error('Post creation failed:', error);
      handleFirestoreError(error, OperationType.CREATE, 'posts');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-24 font-sans">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">Upload Food</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Share your meal and get health insights.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/10 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!image && !isCameraActive ? (
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 dark:border-white/20 rounded-[2rem] p-12 flex flex-col items-center justify-center text-zinc-500 hover:text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all duration-300 cursor-pointer min-h-[300px] bg-zinc-100 dark:bg-white/5 backdrop-blur-xl"
          >
            <div className="w-20 h-20 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner shadow-white/10">
              <UploadCloud className="w-10 h-10" />
            </div>
            <p className="text-xl font-medium mb-2 text-zinc-900 dark:text-white">Share your meal</p>
            <p className="text-sm">JPEG, PNG up to 5MB</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={startCamera}
              className="flex items-center justify-center gap-3 py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-zinc-900/20 dark:shadow-white/5"
            >
              <Camera className="w-6 h-6" />
              <span className="text-lg">Take Photo</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 py-5 bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white rounded-2xl font-bold border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all active:scale-95 shadow-xl shadow-zinc-200/50 dark:shadow-black/20"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-lg">Gallery</span>
            </button>
          </div>

          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
        </div>
      ) : isCameraActive ? (
        <div className="relative rounded-[2.5rem] overflow-hidden bg-black aspect-[3/4] shadow-2xl border border-white/10">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Scanning Animation Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_30px_rgba(234,179,8,1)] animate-scan-fast z-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-transparent to-yellow-500/5" />
            
            {/* Corner Brackets */}
            <div className="absolute top-10 left-10 w-12 h-12 border-t-4 border-l-4 border-yellow-500 rounded-tl-2xl" />
            <div className="absolute top-10 right-10 w-12 h-12 border-t-4 border-r-4 border-yellow-500 rounded-tr-2xl" />
            <div className="absolute bottom-10 left-10 w-12 h-12 border-b-4 border-l-4 border-yellow-500 rounded-bl-2xl" />
            <div className="absolute bottom-10 right-10 w-12 h-12 border-b-4 border-r-4 border-yellow-500 rounded-br-2xl" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                <p className="text-white font-bold tracking-widest uppercase text-xs animate-pulse">Detecting Food...</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => stopCamera(cameraStream)}
            className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-xl transition-colors border border-white/10 z-30"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="relative rounded-[2rem] overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 shadow-2xl shadow-zinc-200/50 dark:shadow-black/50">
            <img src={image} alt="Upload preview" className="w-full h-auto max-h-[500px] object-cover" />
            
            {isAnalyzing && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] animate-scan z-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-yellow-500/10" />
              </div>
            )}

            <button 
              onClick={() => { setImage(null); setAnalysis(null); }}
              className="absolute top-5 right-5 p-2.5 bg-zinc-50 dark:bg-black/50 hover:bg-zinc-50 dark:bg-black/80 rounded-full backdrop-blur-xl transition-colors border border-zinc-200 dark:border-white/10"
            >
              <X className="w-5 h-5 text-zinc-900 dark:text-white" />
            </button>
          </div>

          {!analysis ? (
            <button 
              onClick={() => handleAnalyze()}
              disabled={loading}
              className="w-full py-4 bg-yellow-600 text-white rounded-2xl font-semibold hover:bg-yellow-500 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-yellow-900/30 text-lg"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Analyze Food'}
            </button>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 rounded-[2rem] bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 space-y-6 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
                <div className="flex items-center gap-3 text-emerald-400 mb-4 bg-emerald-500/10 w-fit px-4 py-2 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold text-sm">Analysis Complete</span>
                </div>
                
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Food Detected</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.foodType}</p>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Category</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.category}</p>
                  </div>
                  
                  {/* Health Rating & Score - Restricted for Free */}
                  <div className={clsx(
                    "bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5 transition-all duration-500",
                    !isSubscribed && "blur-md select-none pointer-events-none opacity-50"
                  )}>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Health Rating</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.healthRating}</p>
                  </div>
                  <div className={clsx(
                    "bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5 transition-all duration-500",
                    !isSubscribed && "blur-md select-none pointer-events-none opacity-50"
                  )}>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Health Score</p>
                    <p className="font-semibold text-2xl text-yellow-500 tracking-tight">{analysis.healthScore}<span className="text-sm text-zinc-500 font-medium">/100</span></p>
                  </div>

                  {!isSubscribed && (
                    <div className="absolute inset-x-0 bottom-0 top-[calc(50%+12px)] flex items-center justify-center z-20">
                      <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-xl flex flex-col items-center gap-2 text-center max-w-[80%]">
                        <Lock className="w-5 h-5 text-yellow-500" />
                        <p className="text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Upgrade to Pro for Health Insights</p>
                        <Link to="/dashboard/subscription" className="text-[10px] text-yellow-500 font-bold hover:underline">View Plans</Link>
                      </div>
                    </div>
                  )}
                </div>

                <div className={clsx(
                  "grid grid-cols-4 gap-4 pt-4 border-t border-zinc-200 dark:border-white/10 transition-all duration-500",
                  !isSubscribed && "blur-sm select-none pointer-events-none opacity-40"
                )}>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Calories</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{analysis.calories}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Protein</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{analysis.protein}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Carbs</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{analysis.carbs}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Fat</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{analysis.fat}g</p>
                  </div>
                </div>
                
                <div className={clsx(
                  "pt-6 border-t border-zinc-200 dark:border-white/10 transition-all duration-500",
                  !isSubscribed && "blur-sm select-none pointer-events-none opacity-40"
                )}>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-3">Health Tip</p>
                  <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">{analysis.healthTips}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 ml-1">Caption (Optional)</label>
                <textarea 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent min-h-[120px] resize-none transition-all"
                />
              </div>

              <button 
                onClick={handlePost}
                disabled={loading}
                className="w-full py-4 bg-yellow-600 text-white rounded-2xl font-semibold hover:bg-yellow-500 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-yellow-900/30 text-lg"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Share Post'}
              </button>
            </div>
          )}
        </div>
      )}

      {isQuotaLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border border-zinc-200 dark:border-white/10">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
              <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Quota Limit Reached</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              High traffic detected. We are processing your request. Please wait a moment...
            </p>
            <div className="w-full bg-zinc-100 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-yellow-500 h-full animate-progress" />
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border border-zinc-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Scan Declined</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              {declineModal.isTimeout 
                ? "You've reached the maximum failed attempts. Please wait 5 minutes before scanning again."
                : "We couldn't detect any food in this image. Please scan only food items to continue."}
            </p>

            {!declineModal.isTimeout && (
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className={clsx(
                      "w-12 h-1.5 rounded-full transition-all duration-500",
                      i <= declineModal.attempts ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-zinc-200 dark:bg-white/10"
                    )}
                  />
                ))}
              </div>
            )}

            <button 
              onClick={() => {
                setDeclineModal(null);
                setImage(null);
              }}
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all active:scale-95"
            >
              Try Again
            </button>
            
            {!declineModal.isTimeout && (
              <p className="mt-4 text-xs font-medium text-zinc-400 uppercase tracking-widest">
                Attempt {declineModal.attempts} of 3
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
