declare module '@mediapipe/tasks-vision' {
  export type NormalizedLandmark = {
    x: number;
    y: number;
    z?: number;
  };

  export class FilesetResolver {
    static forVisionTasks(baseUrl: string): Promise<unknown>;
  }

  export type HandLandmarkerOptions = {
    baseOptions: {
      modelAssetPath: string;
      delegate?: string;
    };
    runningMode: 'VIDEO' | 'IMAGE';
    numHands?: number;
  };

  export type HandLandmarkerResult = {
    landmarks: NormalizedLandmark[][];
  };

  export class HandLandmarker {
    static createFromOptions(
      fileset: unknown,
      options: HandLandmarkerOptions,
    ): Promise<HandLandmarker>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult;
    close(): void;
  }
}
