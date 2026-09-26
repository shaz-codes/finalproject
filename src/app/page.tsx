import { auth, signIn, signOut } from "../../auth";

export default async function Home() {
	const session = await auth();

	return (
		<main className="auth-page">
			<div className="auth-topline">
				<a className="wordmark" href="/" aria-label="Home">
					<span className="wordmark-mark" aria-hidden="true">
						A
					</span>
					<span>ATELIER</span>
				</a>
				<span className="topline-note">A quieter place to begin</span>
			</div>

			<section className="auth-layout" aria-labelledby="auth-title">
				<div className="auth-copy">
					<p className="eyebrow">YOUR SPACE, YOUR PACE</p>
					<h1 id="auth-title">
						{session ? "Good to see you." : "Make room for\nwhat matters."}
					</h1>
					<p className="intro-copy">
						{session
							? "You’re signed in and ready to continue."
							: "Sign in securely with an account you already trust. No new password to remember."}
					</p>
					<div className="quiet-mark" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
					<p className="aside-note">
						A considered space for your next chapter.
					</p>
				</div>

				<div className="auth-panel">
					{session ? (
						<div className="signed-in-state">
							<div className="avatar" aria-hidden="true">
								{(session.user?.name ?? session.user?.email ?? "A")
									.charAt(0)
									.toUpperCase()}
							</div>
							<p className="eyebrow">SIGNED IN</p>
							<h2>{session.user?.name ?? "Welcome back"}</h2>
							<p className="panel-copy">{session.user?.email}</p>
							<form
								action={async () => {
									"use server";
									await signOut({ redirectTo: "/" });
								}}
							>
								<button className="oauth-button secondary-button" type="submit">
									Sign out
								</button>
							</form>
						</div>
					) : (
						<>
							<p className="eyebrow">WELCOME</p>
							<h2>Sign in to continue</h2>
							<p className="panel-copy">
								Choose your preferred sign-in method.
							</p>
							<div className="provider-list">
								<form
									action={async () => {
										"use server";
										await signIn("google", { redirectTo: "/" });
									}}
								>
									<button className="oauth-button" type="submit">
										<span
											className="provider-mark google-mark"
											aria-hidden="true"
										>
											G
										</span>
										Continue with Google
									</button>
								</form>
								<form
									action={async () => {
										"use server";
										await signIn("github", { redirectTo: "/" });
									}}
								>
									<button className="oauth-button" type="submit">
										<span
											className="provider-mark github-mark"
											aria-hidden="true"
										>
											GH
										</span>
										Continue with GitHub
									</button>
								</form>
							</div>
							<div className="secure-note">
								<span className="secure-dot" aria-hidden="true" />
								Your sign-in is encrypted and secure
							</div>
						</>
					)}
				</div>
			</section>

			<footer className="auth-footer">
				<span>© 2026 Atelier</span>
				<span>Thoughtfully yours.</span>
			</footer>
		</main>
	);
}
