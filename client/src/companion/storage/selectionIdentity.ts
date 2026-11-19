// PostgreSQL uses md5(library UUID || ':' || book UUID)::uuid. This is an
// identity derivation, not a security hash. Inputs are ASCII UUID strings.
export function selectionIdentity(library: string, book: string): string {
    const input = new TextEncoder().encode(`${library}:${book}`);
    const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
    bytes.set(input); bytes[input.length] = 128;
    const view = new DataView(bytes.buffer);
    view.setUint32(bytes.length - 8, input.length * 8, true);
    const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
    const shifts = [[7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21]];
    for (let offset = 0; offset < bytes.length; offset += 64) {
        let [a, b, c, d] = state;
        for (let i = 0; i < 64; i++) {
            const round = Math.floor(i / 16);
            const f = round === 0 ? (b & c) | (~b & d) : round === 1 ? (d & b) | (~d & c) : round === 2 ? b ^ c ^ d : c ^ (b | ~d);
            const g = round === 0 ? i : round === 1 ? (5 * i + 1) % 16 : round === 2 ? (3 * i + 5) % 16 : (7 * i) % 16;
            const sum = (a + f + Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) + view.getUint32(offset + g * 4, true)) | 0;
            const shift = shifts[round][i % 4];
            [a, b, c, d] = [d, (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0, b, c];
        }
        [a, b, c, d].forEach((value, i) => { state[i] = (state[i] + value) | 0; });
    }
    const result = new DataView(new ArrayBuffer(16));
    state.forEach((value, i) => result.setInt32(i * 4, value, true));
    const hex = Array.from(new Uint8Array(result.buffer), n => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
