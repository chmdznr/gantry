// Clipboard API tidak tersedia di HTTP non-localhost (BIMTEK), jadi salinan
// jatuh ke textarea sementara + execCommand — masih dipicu klik user.
function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.readOnly = true
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // jatuh ke fallback di bawah
    }
  }
  return legacyCopy(text)
}
