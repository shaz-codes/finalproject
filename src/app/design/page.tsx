import { redirect } from "next/navigation";
import { DesignWorkspace } from "@/components/design/DesignWorkspace";
import { auth } from "../../../auth";

export default async function DesignPage() {
	const session = await auth();
	if (!session) redirect("/");

	return (
		<main className="design-page">
			<header className="design-header">
				<a className="wordmark" href="/" aria-label="Home">
					<span className="wordmark-mark" aria-hidden="true">
						A
					</span>
					<span>ATELIER</span>
				</a>
				<span className="topline-note">Room designer</span>
			</header>
			<DesignWorkspace />
		</main>
	);
}
