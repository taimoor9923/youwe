// This example is for guidance purposes. Copying it will come with caveats.
import React, { useState, useCallback, useEffect } from 'react';
import { Page, Card, IndexTable, Badge, IndexFilters, ChoiceList, useSetIndexFiltersMode, useIndexResourceState, Box, InlineStack, Button } from '@shopify/polaris';
import { useLoaderData, useNavigate } from "@remix-run/react";
import "../styles/style.css"
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const boards = await prisma.board.findMany({ where: { shopId: session.shop } });
  return boards;
};
export const BoardList = () => {

  const boardDataTemp = useLoaderData();
  const [boardData, setBoardData] = useState(boardDataTemp);
  const [filteredBoards, setFilteredBoards] = useState(boardData);
  const [filter, setFilter] = useState("all");

  const navigate = useNavigate();

  function disambiguateLabel(key, value) {
    switch (key) {
      case "type":
        return value.map((val) => `type: ${val}`).join(", ");
      case "tone":
        return value.map((val) => `tone: ${val}`).join(", ");
      default:
        return value;
    }
  }
  function isEmpty(value) {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const [itemStrings, setItemStrings] = useState([
    "All",
    "Active",
    "Inactive"

  ]);
  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    let updatedBoards = boardData;
    if (newFilter === "active") {
      updatedBoards = boardData.filter(board => board.status === true);
    } else if (newFilter === "inactive") {
      updatedBoards = boardData.filter(board => board.status === false);
    }
    setFilteredBoards(updatedBoards);
  }, [boardData]);


  const tabs = itemStrings.map((item, index) => ({
    content: item,
    index,
    onAction: () => { handleFilterChange(item.toLowerCase()); },
    id: `${item}-${index}`,
    isLocked: index === 0,
    actions:
      index === 0
        ? []
        : [
          {
            type: "rename",
            onAction: () => { },
            onPrimaryAction: async (value) => {
              const newItemsStrings = tabs.map((item, idx) => {
                if (idx === index) {
                  return value;
                }
                return item.content;
              });
              await sleep(1);
              setItemStrings(newItemsStrings);
              return true;
            },
          }
        ],
  }));
  const [selected, setSelected] = useState(0);
  const onCreateNewView = async (value) => {
    await sleep(500);
    setItemStrings([...itemStrings, value]);
    setSelected(itemStrings.length);
    return true;
  };
  const sortOptions = [
    { label: "Date Created", value: "product asc", directionLabel: "Ascending" },
    { label: "A-Z Name", value: "product desc", directionLabel: "Descending" },

  ];
  const [sortSelected, setSortSelected] = useState(["product asc"]);
  const { mode, setMode } = useSetIndexFiltersMode();
  const onHandleCancel = () => { };
  const onHandleSave = async () => {
    await sleep(1);
    return true;
  };
  const primaryAction = {
    type: "save",
    onAction: onHandleSave,
    disabled: false,
    loading: false,
  };
  const [tone, setStatus] = useState(undefined);
  const [type, setType] = useState(undefined);
  const [queryValue, setQueryValue] = useState("");
  const handleStatusChange = useCallback((value) => setStatus(value), []);
  const handleTypeChange = useCallback((value) => setType(value), []);
  const handleFiltersQueryChange = useCallback(
    (value) => {
       setQueryValue(value);
      const lowercasedFilter = value.toLowerCase();
      const filteredData = boardData.filter(item =>
        item.title.toLowerCase().includes(lowercasedFilter) ||
        item.collectionTitle.toLowerCase().includes(lowercasedFilter)
      );
      setFilteredBoards(filteredData);
    },
    [boardData]
  );
  const handleStatusRemove = useCallback(() => setStatus(undefined), []);
  const handleTypeRemove = useCallback(() => setType(undefined), []);
  const handleQueryValueRemove = useCallback(() => setFilteredBoards(boardData), []);
  const handleFiltersClearAll = useCallback(() => {
    handleStatusRemove();
    handleTypeRemove();
    handleQueryValueRemove();
    setFilteredBoards(boardData);
  }, [handleStatusRemove, handleQueryValueRemove, handleTypeRemove]);
  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="status"
          titleHidden
          choices={[
            { label: "All", value: "all" },
            { label: "Inactive", value: "inactive" },
            { label: "Archived", value: "archived" },
          ]}
          selected={tone || []}
          onChange={handleStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: "type",
      label: "Type",
      filter: (
        <ChoiceList
          title="Type"
          titleHidden
          choices={[
            { label: "Brew Gear", value: "brew-gear" },
            { label: "Brew Merch", value: "brew-merch" },
          ]}
          selected={type || []}
          onChange={handleTypeChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];
  const appliedFilters = [];
  if (tone && !isEmpty(tone)) {
    const key = "tone";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, tone),
      onRemove: handleStatusRemove,
    });
  }
  if (type && !isEmpty(type)) {
    const key = "type";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, type),
      onRemove: handleTypeRemove,
    });
  }
  const boards = filteredBoards.map(board => ({
    id: board.id,
    title: board.title,
    collection: board.collectionTitle,
    tone: board.status ? <Badge tone="success">Active</Badge> : <Badge >Inactive</Badge>,
    edit: <button onClick={() => navigate(`/app/createBoard/${board.id}`)} style={{ textDecoration: 'underline', color: '#0070f3', padding: 0, border: 'none', background: 'none', cursor: "pointer" }}>edit</button>
  }));

  const resourceName = {
    singular: "board",
    plural: "boards",
  };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(boards);
  const rowMarkup = boards.map(
    (
      { id, title, collection, tone, edit },
      index
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >

        <IndexTable.Cell>{title}</IndexTable.Cell>
        <IndexTable.Cell>{collection}</IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack>
            <Box>{tone}</Box>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack>
            <Box>{edit}</Box>
          </InlineStack>
        </IndexTable.Cell>

      </IndexTable.Row>
    )
  );
  return (
    <Page
      title={"Overview"}
      primaryAction={<Button onClick={() => navigate(`/app/createBoard/new`)} variant="primary">Create board</Button>}

    >
      <Card padding="0">
        <IndexFilters
          sortOptions={sortOptions}
          sortSelected={sortSelected}
          queryValue={queryValue}
          queryPlaceholder="Searching in all"
          onQueryChange={handleFiltersQueryChange}
          onQueryClear={() => { setFilteredBoards(boardData); setQueryValue('') }}
          onSort={setSortSelected}
          primaryAction={primaryAction}
          cancelAction={{
            onAction: onHandleCancel,
            disabled: false,
            loading: false,
          }}
          tabs={tabs}
          selected={selected}
          onSelect={setSelected}
          canCreateNewView={false}
          onCreateNewView={onCreateNewView}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={handleFiltersClearAll}
          mode={mode}
          setMode={setMode}
        />
        <IndexTable
          resourceName={resourceName}
          itemCount={boards.length}
          selectable={false}
          onSelectionChange={handleSelectionChange}
          sortable={[false, false, false]}
          headings={[

            { title: "Title" },
            { title: "Collection" },
            { title: "Status" },
            { title: " " }

          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  )
}