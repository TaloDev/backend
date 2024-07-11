export default function generateSixDigitCode() {
  return Math.random().toString().substring(2, 8)
}
