import React, { useState, useEffect } from 'react';
import { TextField, Select, Button, InlineStack, BlockStack, Box, Icon } from '@shopify/polaris';
import { MinusCircleIcon, DragHandleIcon } from '@shopify/polaris-icons';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../styles/style.css';

export const ColumnConfigurator = ({ parentColumns, onColumnsChange }) => {

  const [columns, setColumns] = useState([
    { id: 'column-1', label: 'Rank', value: 'Row #', removable: false },
    { id: 'column-2', label: 'Team name', value: 'Product name', removable: false }
  ]);


  useEffect(() => {
    if (parentColumns) {
      setColumns(JSON.parse(JSON.parse(parentColumns)));
    }
  }, [parentColumns])


  const handleAddColumn = () => {
    const newColumn = { id: `column-${columns.length + 1}`, label: '', value: '', removable: true };
    setColumns([...columns, newColumn]);
  };

  const handleRemoveColumn = (id) => {
    setColumns(columns.filter(column => column.id !== id));
  };

  const handleLabelChange = (id, newValue) => {
    const updatedColumns = columns.map(column => column.id === id ? { ...column, label: newValue } : column);
    setColumns(updatedColumns);
  };

  const handleValueChange = (id, newValue) => {
    const updatedColumns = columns.map(column => column.id === id ? { ...column, value: newValue } : column);
    setColumns(updatedColumns);
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }

    const reorderedColumns = Array.from(columns);
    const [movedColumn] = reorderedColumns.splice(result.source.index, 1);
    reorderedColumns.splice(result.destination.index, 0, movedColumn);

    setColumns(reorderedColumns);
  };

  useEffect(() => {
    onColumnsChange(columns);
  }, [columns, onColumnsChange]);

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="columns">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              <BlockStack align="start" gap="400">
                {columns.map((column, index) => (
                  <Draggable key={column.id} draggableId={column.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <InlineStack key={column.id} gap="400" align="start" blockAlign="center">
                          <div {...provided.dragHandleProps}>
                            <Icon source={DragHandleIcon} tone="base" />
                          </div>
                          <TextField
                            label=""
                            value={column.label}
                            onChange={(value) => handleLabelChange(column.id, value)}
                          />
                          <div className='equal-width-203'>
                            <Select
                              label=""
                              options={[
                                { label: 'Row #', value: 'Row #' },
                                { label: 'Product name', value: 'Product name' },
                                { label: 'Products ordered (#)', value: 'Products ordered (#)' },
                                { label: 'Total amount ($)', value: 'Total amount' },
                                { label: '⁠number of unique customers (#)', value: 'Total unique customer' }
                              ]}
                              value={column.value}
                              onChange={(value) => handleValueChange(column.id, value)}
                            />
                          </div>
                          {column.removable ? (
                            <Button destructive variant="plain" onClick={() => handleRemoveColumn(column.id)}>
                              <Icon source={MinusCircleIcon} tone="primary" />
                            </Button>
                          ) : (
                            <div>
                              <Icon source={MinusCircleIcon} tone="subdued" />
                            </div>
                          )}
                        </InlineStack>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </BlockStack>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {columns.length < 5 && (
        <Box paddingBlockStart="400">
          <Button onClick={handleAddColumn}>Add new column</Button>
        </Box>
      )}
    </div>
  );
};
