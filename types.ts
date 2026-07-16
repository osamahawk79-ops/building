export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  subscription: 'none' | 'bronze' | 'gold';
  subscriptionStatus: 'none' | 'pending' | 'active' | 'blocked';
  pendingSubscriptionType: 'none' | 'bronze' | 'gold';
  paymentTxInfo: {
    amount: string;
    txNumber: string;
    walletProvider: string;
    date: string;
    screenshotUrl?: string; // Optional if they paste/add any url
  } | null;
  createdAt: string;
  subscriptionActivatedAt?: string; // ISO date string when subscription was activated
  subscriptionExpiresAt?: string; // ISO date string when subscription expires
  downloadCounter?: number; // How many files user has downloaded
  maxDownloads?: number; // Max allowed downloads (-1 for unlimited)
}

export interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl?: string; // Optional category image or preview thumbnail
  previewUrl?: string; // Added for MP4/GIF animated banners
  createdAt?: string;
}

export interface Lecture {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  videoUrl: string;
  videoProvider: 'bunny' | 'vimeo' | 'youtube' | 'raw' | 'local';
  fileUrl: string; // empty string means no file
  fileName: string;
  tierRequired: 'free' | 'bronze' | 'gold';
  createdAt?: string;
  thumbnailUrl?: string;
  // NEW: Smart Media Tracking Fields
  videoFileName?: string;
  videoSize?: number;
  videoExtension?: string;
  lastKnownPath?: string;
  videoChecksum?: string;
  attachmentFileName?: string;
  attachmentSize?: number;
  attachmentExtension?: string;
  attachmentLastKnownPath?: string;
  fileStatus?: 'found' | 'missing';
  lastModified?: string;
}

export interface WalletDetails {
  name: string;
  number: string;
  provider: string; // e.g. "فودافون كاش", "إنستا باي InstaPay"
}

export interface LMSConfig {
  siteName: string;
  logoUrl: string;
  logoWidth?: number;
  logoHeight?: number;
  logoPadding?: number;
  fontFamily?: 'Inter' | 'Cairo' | 'Tajawal' | 'Roboto';
  heroMediaUrl?: string; // Added
  heroMediaType?: 'image' | 'video'; // Added
  heroOpacity?: number; // Added
  heroBlur?: number; // Added
  mainTitle: string;
  subTitle: string;
  primaryColor: string;
  mediaRootFolder?: string; // Root folder for local media server
  mediaFolders?: string[]; // Multiple search locations for media
  paymentDetails: {
    walletNumbers: WalletDetails[];
  };
}
