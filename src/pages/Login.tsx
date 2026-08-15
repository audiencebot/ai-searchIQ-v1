/**
 * Placeholder login page so /login resolves before the auth graft lands.
 * The backend graft owns and will overwrite this file (see react-dev.md
 * "Full-Stack Auth Contract") — do not add OAuth/session logic here.
 */
export default function Login() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-label text-ares-primary">Member access</p>
      <h1 className="font-display mt-4 text-[40px]">Login</h1>
      <div className="mt-6 h-px w-16 bg-ares-primary" />
      <p className="font-body mt-6 max-w-md text-ares-secondarytext">
        Sign in to your tenant workspace. Authentication is being connected.
      </p>
    </div>
  );
}
