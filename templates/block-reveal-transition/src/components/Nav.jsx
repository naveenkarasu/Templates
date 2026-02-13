import Link from "next/link";

export default function Nav() {
  return (
    <nav>
      <Link href="/">Homebase</Link>
      <Link href="/gateway">Gateway</Link>
      <Link href="/station">Station</Link>
      <Link href="/colony">Colony</Link>
    </nav>
  );
}
