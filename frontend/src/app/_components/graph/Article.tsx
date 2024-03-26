import { Typography } from "@mui/material";
import { type Article } from "~/server/api/routers/post";

export default function ArticleComponent({ article }: { article: Article }) {
  return (
    <article>
      <div className="flex flex-col border border-gray-300 p-5">
        <table>
          <tbody>
            <tr>
              <th>
                <Typography variant="subtitle2">Publication</Typography>
              </th>
              <td>
                <Typography variant="body1">{article.pub_name}</Typography>
              </td>
            </tr>
            <tr>
              <th>
                <Typography variant="subtitle2">Pub Date</Typography>
              </th>
              <td>
                <Typography variant="body1">
                  {article.pub_date?.toLocaleDateString()}
                </Typography>
              </td>
            </tr>
            <tr>
              <th>
                <Typography variant="subtitle2">Pub Time</Typography>
              </th>
              <td>
                <Typography variant="body1">
                  {article.pub_time?.toLocaleTimeString()}
                </Typography>
              </td>
            </tr>
            <tr>
              <th className="pr-5">
                <Typography variant="subtitle2">GPHIN Score</Typography>
              </th>
              <td>
                <Typography variant="body1">{article.gphin_score}</Typography>
              </td>
            </tr>
            <tr>
              <th>
                <Typography variant="subtitle2">GPHIN State</Typography>
              </th>
              <td>
                <Typography variant="body1">{article.gphin_state}</Typography>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {article.content?.split("\n").map((content, i) => (
        <Typography
          key={i}
          variant="body1"
          mt={2}
          className="whitespace-pre-wrap"
        >
          {content}
        </Typography>
      ))}
    </article>
  );
}
