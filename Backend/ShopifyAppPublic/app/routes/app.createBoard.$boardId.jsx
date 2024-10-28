import {
  Box,
  Card,
  TextField,
  Text,
  Page,
  Form,
  Button,
  FormLayout,
  Select,
  BlockStack,

  InlineStack,

  Icon, Spinner,
  Thumbnail,
  Badge,

  Modal

} from "@shopify/polaris";
import {
  ImageIcon, DeleteIcon
} from '@shopify/polaris-icons';
import '../styles/style.css'
import { useNavigate, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { fetchProducts, saveBoard, deleteBoard, toggleBoard } from '../actions';
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { ColumnConfigurator } from '../components/ColumnConfigurator';
import { ColorPickerWithPreview } from '../components/ColorPickerWithPreview';
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
export const SAVE_BAR_ID = 'create-board-save-bar';

import { useEffect, useState, useCallback } from 'react';

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  const { boardId } = params;

  if (boardId && boardId !== 'new') {
    const board = await prisma.board.findUnique({
      where: { id: boardId }

    });


    return json({ board });
  }

  return json(null);
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
   // Fetch all products in a specific collection
  const formData = await request.formData();

  const actionType = formData.get('_action');
  switch (actionType) {
    case 'fetchProducts':
      return await fetchProducts(admin, formData, session.shop);
    case 'saveBoard':
      return await saveBoard(admin, formData, session.shop);
    case 'deleteBoard':
      return await deleteBoard(admin, formData, session.shop);
    case 'toggleBoardStatus':
      return await toggleBoard(admin, formData, session.shop);
    default:
      return json({ error: 'Unknown action' });
  }

};


export default function CreateBoard() {

  const [boardTitle, setboardTitle] = useState('');
  const [rowsToDisplay, setRowsToDisplay] = useState('7');
  const [titleTextColor, setTitleTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [sortRowsBy, setSortRowsBy] = useState('Total amount ($), high to low');
  const [columns, setColumns] = useState([]);
  const [collection, setCollection] = useState(null);
  const [collectionId, setCollectionId] = useState(null);
  const [collectionProducts, setCollectionProducts] = useState([]);
  const [collectionImg, setCollectionImg] = useState("");
  const [collectionCount, setCollectionCount] = useState("");
  const [collectionStatus, setCollectionStatus] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [editBoardData, setEditBoardData] = useState(useLoaderData());
  const shopify = useAppBridge();
  const fetcher = useFetcher();
  const saveFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  const navigate = useNavigate();


  useEffect(() => {
    if (editBoardData && editBoardData.board) {
       const board = editBoardData.board;
      setboardTitle(board.title);
      setRowsToDisplay(board.rowsToDisplay.toString());
      setTitleTextColor(board.titleTextColor);
      setBackgroundColor(board.backgroundColor);
      setSortRowsBy(board.sortRowsBy);
      //  setColumns(JSON.parse(board.columnConfiguration));
      setCollection(board.collectionTitle);
      setCollectionId(board.collectionId);
      setCollectionImg(board.collectionImg);
      setCollectionCount(board.collectionCount);
      setCollectionStatus(board.collectionStatus);
      const collectionId = board.collectionId;

      //sbmit fetcher to get products if for collection id in edit board
      fetcher.submit(
        { collectionId, _action: 'fetchProducts' },
        { method: "post" }
      );
    }
  }, []);
  useEffect(() => {
    
  }, [rowsToDisplay]);
  const handleRowsToDisplayChange = useCallback(
    (value) => setRowsToDisplay(value),
    []
  );

  const handleSortRowsByChange = useCallback(
    (value) => setSortRowsBy(value),
    []
  );

  const handleColumnsChange = (newColumns) => {
    setColumns(newColumns);

  };




  const handleChange = useCallback(
    (newValue) => setboardTitle(newValue),
    [],
  );
  const handleSubmit = useCallback(() => {
    boardTitle('');

  }, []);

  const handleBoardSubmit = useCallback(() => {
    const formData = new FormData();

    formData.append('_action', 'saveBoard');
    formData.append('boardTitle', boardTitle);
    formData.append('collectionTitle', collection);
    formData.append('rowsToDisplay', rowsToDisplay);
    formData.append('sortRowsBy', sortRowsBy);
    formData.append('titleTextColor', titleTextColor);
    formData.append('backgroundColor', backgroundColor);
    formData.append('columns', JSON.stringify(columns));
    formData.append('collectionProducts', JSON.stringify(collectionProducts));
    formData.append('collectionId', collectionId?.toString() || '');
    formData.append('collectionImg', collectionImg?.toString() || '');
    formData.append('collectionCount', collectionCount?.toString() || '');
    formData.append('collectionStatus', collectionStatus?.toString() || '');
    if (editBoardData != null && editBoardData.board != null) {
      formData.append('boardId', editBoardData.board.id);
    }

    saveFetcher.submit(formData, { method: 'post' });

  }, [boardTitle, collection, rowsToDisplay, sortRowsBy, titleTextColor, backgroundColor, columns, collectionProducts, collectionId, collectionImg, collectionCount, collectionStatus, saveFetcher]);

  useEffect(() => {
 
  }, [columns])
  const handleDeleteBoard = useCallback((boardId) => {
    
    setBoardToDelete(boardId);
    setIsModalOpen(true);
  }, []);

  const handleDiscard = useCallback(() => {
    setIsDiscardModalOpen(true);
  }, []);

  const confirmDiscard = useCallback(() => {
    shopify.saveBar.hide(SAVE_BAR_ID);
    setIsDiscardModalOpen(false);
    navigate('/app'); // Navigate to the desired path after deletion
  }, [shopify]);

  const cancelDiscard = useCallback(() => {
    setIsDiscardModalOpen(false);
  }, []);

  const confirmDeleteBoard = useCallback(() => {
    const formData = new FormData();
    formData.append('_action', 'deleteBoard');
    formData.append('boardId', boardToDelete);

    deleteFetcher.submit(formData, { method: 'post' });
    setIsModalOpen(false);
    shopify.toast.show('Board Deleted', { duration: 1000, error: false });

  }, [boardToDelete, deleteFetcher]);

  useEffect(() => {
    if (deleteFetcher.data && deleteFetcher.data.success) {
      shopify.saveBar.hide(SAVE_BAR_ID);
      navigate('/app'); // Navigate to the desired path after deletion
    }
  }, [deleteFetcher.data, navigate]);
  useEffect(() => {
    if (saveFetcher.data && saveFetcher.data.success) {
      shopify.saveBar.hide(SAVE_BAR_ID);
      if (saveFetcher.data.updated === true) {
        shopify.toast.show('Board Updated', { duration: 1000, error: false });

      } else {
        shopify.toast.show('Board Created', { duration: 1000, error: false });

      }

      navigate('/app'); // Change this to the path you want to redirect to
    }
  }, [saveFetcher.data, navigate]);

  const handleToggleBoardStatus = useCallback((boardId, currentStatus) => {
    const formData = new FormData();
    formData.append('_action', 'toggleBoardStatus');
    formData.append('boardId', boardId);
    formData.append('newStatus', (!currentStatus).toString()); // Toggle the status

    toggleFetcher.submit(formData, { method: 'post' });
  }, [toggleFetcher]);


  useEffect(() => {
    if (toggleFetcher.data && toggleFetcher.data.success) {
      shopify.saveBar.hide(SAVE_BAR_ID);
      navigate('/app'); // Navigate to the desired path after toggling
    }
  }, [toggleFetcher.data, navigate])

  useEffect(() => {
    if (boardTitle) {
      shopify.saveBar.show(SAVE_BAR_ID);
    } else {
      shopify.saveBar.hide(SAVE_BAR_ID);
    }
  }, [boardTitle, shopify])


  async function resourcepickerOpen() {
   
    let selected = null;
    if (collectionId) {
      selected = await shopify.resourcePicker({
        type: "collection",
        action: "add",
        selectionIds: [{ id: collectionId }]


      });

    } else {
      selected = await shopify.resourcePicker({
        type: "collection",
        action: "add"



      });

    }



    if (selected) {
       setCollection(selected[0].title.toLowerCase());
      setCollectionId(selected[0].id);
      setCollectionProducts([]);
      setCollectionStatus(selected[0].availablePublicationCount > 0 ? true : false);
      // Fetch products in the selected collection
      const collectionId = selected[0].id;
      fetcher.submit(
        { collectionId, _action: 'fetchProducts' },
        { method: "post" }
      );
    }

  }


  useEffect(() => {


    if (fetcher.data && fetcher.data.products != null) {
      setCollectionProducts(fetcher.data.products);
      setCollectionImg(fetcher.data.collectionImg);
      setCollectionCount(fetcher.data.collectionCount);

    }
  }, [fetcher.data]);

  useEffect(() => {

  }, [collectionProducts]);


  const removeCollection = () => {
    setCollection(null);
    setCollectionId(null);
    setCollectionProducts([]);
  }

  return (
    <Page
      backAction={{ content: 'Homepage', onAction: () => handleDiscard() }}
      title={editBoardData && editBoardData.board ? "Edit Board" : "Create Board"}
      titleMetadata={editBoardData && editBoardData.board ? (
        editBoardData.board.status ? <Badge tone="success">Active</Badge> : <Badge tone="attention">Inactive</Badge>
      ) : <></>}
      secondaryActions={editBoardData && editBoardData.board ? [
        {
          content: editBoardData.board.status ? 'Turn board off' : 'Turn board on',
          accessibilityLabel: editBoardData.board.status ? 'Turn off board' : 'Turn on board',
          onAction: () => handleToggleBoardStatus(editBoardData.board.id, editBoardData.board.status),
        },
        { content: 'Delete board', destructive: true, icon: DeleteIcon, onAction: () => handleDeleteBoard(editBoardData.board.id) },
      ] : []}
    >
      <BlockStack gap="500">
        <Card title="Create Board" sectioned>
          <Form onSubmit={handleSubmit} data-save-bar onreset="console.log('discarding')">
            <FormLayout>

              <TextField
                label="Title"
                value={boardTitle}
                onChange={handleChange}
                autoComplete="off"
              />
              <ColumnConfigurator parentColumns={editBoardData && editBoardData.board.columnConfiguration} onColumnsChange={handleColumnsChange} />


            </FormLayout>
          </Form>


        </Card>
        <Card sectioned>


          <Button onClick={resourcepickerOpen} plain>
            Select Collection
          </Button>

          {fetcher.state === 'submitting' ? <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}> <Spinner size="small" /></div> :
            <div>
              {collection ?
                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #EBEBEB" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "900px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {collectionImg !== "" ? <Thumbnail
                        source={`${collectionImg}`}
                        alt="collectionImage"
                        size="small"
                      /> : <Icon
                        source={ImageIcon}
                        tone="base"
                      />}
                      <div style={{ marginLeft: "10px" }}>
                        <Text variant="bodyMd" as="p">
                          {collection}
                        </Text>
                      </div>
                    </div>


                    {collectionCount !== "" ? <div style={{ display: "flex", alignItems: "center" }}> <Text variant="bodyMd" as="p">
                      {collectionCount} Products
                    </Text>  </div> : null}
                    <div style={{ display: "flex", alignItems: "center" }}> {collectionStatus ? <Badge tone="success">Active</Badge> : <Badge tone="attention">Inactive</Badge>
                    }</div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      <button onClick={removeCollection} style={{ color: '#0070f3', padding: 0, border: 'none', background: 'none', cursor: "pointer" }}>Remove</button>
                    </div>

                  </div>
                </div> : null
              }

            </div>}


        </Card>
        <Card sectioned>

          <InlineStack gap="400" align="start" blockAlign="center">
            <div className='equal-width-250'>
              <Select
                label="Rows to display"
                options={[
                  { label: '3', value: '3' },
                  { label: '5', value: '5' },
                  { label: '7', value: '7' },
                  { label: '10', value: '10' },
                  { label: '15', value: '15' },
                  { label: '25', value: '25' },
                  { label: '50', value: '50' },
                  { label: '100', value: '100' },
                ]}
                value={rowsToDisplay}
                onChange={handleRowsToDisplayChange}
              />
            </div>
            <div className='equal-width-250'>
              <Select
                label="Sort rows by"
                options={[
                  { label: 'Product name, (A-Z)', value: 'Product name, (A-Z)' },
                  { label: 'Total amount ($), high to low', value: 'Total amount ($), high to low' },
                  { label: 'Products ordered (#), high to low', value: 'Products ordered (#), high to low' },
                  { label: 'Unique Customer (#), high to low', value: 'Unique customers (#), high to low' },
                ]}
                value={sortRowsBy}
                onChange={handleSortRowsByChange}
              />
            </div>

          </InlineStack>
        </Card>

        <Card title="Styling" sectioned>
          <BlockStack gap="400" align="start" blockAlign="center">
            <ColorPickerWithPreview
              label="Board title text color"
              color={titleTextColor}
              onChange={setTitleTextColor}
            />
            <ColorPickerWithPreview
              label="Background color"
              color={backgroundColor}
              onChange={setBackgroundColor}
            />
          </BlockStack>
        </Card>

        <SaveBar id={SAVE_BAR_ID}>
          <button
            variant="primary"
            onClick={handleBoardSubmit}
            disabled={collection === null || boardTitle === '' || columns.length === 0 || collectionProducts.length === 0 ? true : false}
          >
            Save
          </button>
          <button
            onClick={handleDiscard}
          >
            Discard
          </button>
        </SaveBar>
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Delete board?"
          primaryAction={{
            content: 'Delete board',
            destructive: true,
            onAction: confirmDeleteBoard,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setIsModalOpen(false),
            },
          ]}
        >
          <Modal.Section>

            <p>Are you sure you want to continue? Once a board is deleted, it can't be undone.</p>

          </Modal.Section>
        </Modal>
        <Modal
          open={isDiscardModalOpen}
          onClose={cancelDiscard}
          title="Discard changes?"
          primaryAction={{
            content: 'Discard',
            destructive: true,
            onAction: confirmDiscard,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: cancelDiscard,
            },
          ]}
        >
          <Modal.Section>
            <p>Are you sure you want to discard all your changes will be lost?</p>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}

