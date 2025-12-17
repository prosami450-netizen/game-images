export enum AssetType {
  ICON = 'ICON',
  SCREENSHOT = 'SCREENSHOT'
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}

export interface ExtractedData {
  appName: string | null;
  iconUrl: string | null;
  screenshotUrls: string[];
}

export interface ProcessedAsset {
  originalUrl: string;
  blob: Blob; // The raw image data fetched via proxy
  type: AssetType;
}

export interface ResizeSpec {
  width: number;
  height: number;
  label: string;
}

export const ICON_SPECS: ResizeSpec[] = [
  { width: 114, height: 114, label: 'Icon (114x114)' },
  { width: 512, height: 512, label: 'Icon (512x512)' }
];

export const SCREENSHOT_SPECS: ResizeSpec[] = [
  { width: 1280, height: 720, label: 'Landscape (1280x720)' },
  { width: 720, height: 1280, label: 'Portrait (720x1280)' }
];