
import { useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Button,
  EmptyState,
  Card
} from "@shopify/polaris";
import { authenticate,MONTHLY_PLAN } from "../shopify.server";
import { BoardList } from '../components/BoardList';
import prisma from "../db.server";
import { useLoaderData } from "@remix-run/react";
import emptyStateImage from "../images/Icon.png";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { billing } = await authenticate.admin(request);
  await billing.require({
    plans: [MONTHLY_PLAN],
    isTest: false,
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN, isTest: false }),
  });
  const boards = await prisma.board.findMany({ where: { shopId: session.shop } });
  return boards;
};



export default function Index() {

  const boardData = useLoaderData();
  const navigate = useNavigate();
  const redirectToDashboard = () => {
     navigate(`/app/createBoard/new`);
  };

  return (
    <>
      {boardData.length === 0 ? (
        <Page
          title={"Overview"}
          primaryAction={<Button onClick={() => navigate("/app/createBoard/new")} variant="primary">Create board</Button>}
        >


          <Layout>
            <Layout.Section>
              <Card>

                <EmptyState
                  heading="You have an empty list of boards."
                  action={{ content: 'Create board', onAction: redirectToDashboard, primary: true, size: 'medium' }}

                  image={emptyStateImage}
                >
                  <p>Start creating a new board.</p>
                </EmptyState>
              </Card>

            </Layout.Section>
          </Layout>

        </Page>

      ) : (<BoardList />)}

    </>
  );
}
