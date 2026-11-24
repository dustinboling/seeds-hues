import { APP_SHORT_NAME } from "../../src/site";

/** Error page: the directory's name and a functional message. No new copy. */
export default function Page() {
  return (
    <>
      <h1>{APP_SHORT_NAME}</h1>
      <p>This page could not be loaded.</p>
      <p>
        <a href="/">Back to the start</a>
      </p>
    </>
  );
}
