import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { renderOgImage } from "../../lib/og";

/*
  One preview card per published post at /og/<slug>.png, plus /og/home.png for
  every other page. PostLayout and BaseLayout point og:image at these.
*/
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return [
    { params: { slug: "home" }, props: { title: "Mathematics, personal stories, puzzles." } },
    ...posts.map((post) => ({
      params: { slug: post.id },
      props: {
        title: post.data.title,
        description: post.data.description,
        kicker: post.data.date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      },
    })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props as { title: string; kicker?: string; description?: string });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
