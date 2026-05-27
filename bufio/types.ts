export interface Reader {
  /**
   * Reads up to p.length bytes into p.
   * Returns the number of bytes read or null if EOF is reached.
   */
  read(p: Uint8Array): Promise<number | null>;
}

export interface Writer {
  /**
   * Writes p.length bytes from p to the underlying data stream.
   * Returns the number of bytes written.
   */
  write(p: Uint8Array): Promise<number>;
}
