export class PreflightStore {
    private static stream: MediaStream | null = null;
  
    static setStream(stream: MediaStream | null) {
      this.stream = stream;
    }
  
    static getStream() {
      return this.stream;
    }
  
    static clear() {
      this.stream = null;
    }
  }
