export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function hashIp(ip, salt, day) {
  const input = new TextEncoder().encode(`${salt}\0${ip}\0${day}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
