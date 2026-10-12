export async function readNDJSON(body: ReadableStream<Uint8Array>, receive: (value: unknown) => void): Promise<void> {
  const reader = body.getReader(); const decoder = new TextDecoder(); let pending = ""; let bytes = 0;
  function line(value: string) { if (value.trim()) receive(JSON.parse(value)); }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) throw new Error("AI response exceeds size limit");
      pending += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = pending.indexOf("\n")) !== -1) { line(pending.slice(0, end)); pending = pending.slice(end + 1); }
    }
    pending += decoder.decode(); line(pending);
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
