import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, X, Loader2, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

interface FoodAnalysisResult {
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

export default function Upload() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const base64Data = image.split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              {
                text: "Analyze this food image. Provide the food type, category, health rating (High, Medium, Low), a health score out of 100, health tips, and estimated nutritional values (calories, protein, carbs, fat in grams). If you cannot clearly identify the food, provide your best guess or generic values.",
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                foodType: { type: Type.STRING, description: "Name of the food" },
                category: { type: Type.STRING, description: "Category like Breakfast, Lunch, Snack, etc." },
                healthRating: { type: Type.STRING, description: "Must be exactly 'High', 'Medium', or 'Low'" },
                healthScore: { type: Type.INTEGER, description: "Score from 0 to 100" },
                healthTips: { type: Type.STRING, description: "Short health tip" },
                calories: { type: Type.INTEGER, description: "Estimated calories" },
                protein: { type: Type.INTEGER, description: "Estimated protein in grams" },
                carbs: { type: Type.INTEGER, description: "Estimated carbs in grams" },
                fat: { type: Type.INTEGER, description: "Estimated fat in grams" },
              },
              required: ["foodType", "category", "healthRating", "healthScore", "healthTips", "calories", "protein", "carbs", "fat"],
            },
          },
        });

        const resultText = response.text;
        if (resultText) {
          try {
            const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedResult = JSON.parse(cleanedText) as FoodAnalysisResult;
            setAnalysis(parsedResult);
            break; // Success, exit loop
          } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Text:", resultText);
            throw new Error("Failed to parse AI response format");
          }
        } else {
          throw new Error("Empty response from AI");
        }
      } catch (error: any) {
        console.error(`Analysis failed (retries left: ${retries}):`, error);
        if (retries === 0) {
          alert(`Failed to analyze image: ${error?.message || 'Unknown error'}. Please try a different image.`);
        }
        retries--;
        if (retries >= 0) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s before retry
        }
      }
    }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!user || !profile || !image || !analysis) return;
    setLoading(true);

    try {
      const postRef = doc(collection(db, 'posts'));
      await setDoc(postRef, {
        userId: user.uid,
        authorName: profile.username,
        authorImage: profile.profileImage,
        authorIsCreator: profile.isCreator || false,
        imageUrl: image,
        foodType: analysis.foodType,
        category: analysis.category,
        healthRating: analysis.healthRating,
        healthScore: analysis.healthScore,
        calories: analysis.calories,
        protein: analysis.protein,
        carbs: analysis.carbs,
        fat: analysis.fat,
        caption,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });
      
      // Reward user with 100 points for uploading
      const userRef = doc(db, 'users', user.uid);
      const pointsToEarn = profile.isCreator ? 200 : 100;
      await updateDoc(userRef, {
        points: increment(pointsToEarn),
        postsCount: increment(1)
      });
      
      navigate('/dashboard');
    } catch (error) {
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

      {!image ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-white/20 rounded-[2rem] p-12 flex flex-col items-center justify-center text-zinc-500 hover:text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all duration-300 cursor-pointer min-h-[400px] bg-zinc-100 dark:bg-white/5 backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner shadow-white/10">
            <UploadCloud className="w-10 h-10" />
          </div>
          <p className="text-xl font-medium mb-2 text-zinc-900 dark:text-white">Click to upload photo</p>
          <p className="text-sm">JPEG, PNG up to 5MB</p>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="relative rounded-[2rem] overflow-hidden bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 shadow-2xl shadow-zinc-200/50 dark:shadow-black/50">
            <img src={image} alt="Upload preview" className="w-full h-auto max-h-[500px] object-cover" />
            <button 
              onClick={() => { setImage(null); setAnalysis(null); }}
              className="absolute top-5 right-5 p-2.5 bg-zinc-50 dark:bg-black/50 hover:bg-zinc-50 dark:bg-black/80 rounded-full backdrop-blur-xl transition-colors border border-zinc-200 dark:border-white/10"
            >
              <X className="w-5 h-5 text-zinc-900 dark:text-white" />
            </button>
          </div>

          {!analysis ? (
            <button 
              onClick={handleAnalyze}
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
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Food Detected</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.foodType}</p>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Category</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.category}</p>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Health Rating</p>
                    <p className="font-semibold text-lg text-zinc-900 dark:text-white">{analysis.healthRating}</p>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Health Score</p>
                    <p className="font-semibold text-2xl text-yellow-500 tracking-tight">{analysis.healthScore}<span className="text-sm text-zinc-500 font-medium">/100</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-zinc-200 dark:border-white/10">
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
                
                <div className="pt-6 border-t border-zinc-200 dark:border-white/10">
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
    </div>
  );
}
