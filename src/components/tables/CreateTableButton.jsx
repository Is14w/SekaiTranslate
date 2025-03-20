import React, { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useUser } from "../../contexts/UserContext.jsx";
import { useEditMode } from "../navigation/TopBar.jsx";
import CreateTableModal from "../modals/CreateTableModal.jsx";

function CreateTableButton({ onTableCreated, className = "", buttonStyle = "icon" }) {
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);
  const { user } = useUser();
  const { isEditMode } = useEditMode();
  
  // 判断是否为管理员
  const isAdmin = user?.isAdmin === true;
  
  // 只有管理员且处于编辑模式时才显示按钮
  if (!isAdmin || !isEditMode) {
    return null;
  }
  
  return (
    <>
      {buttonStyle === "icon" ? (
        <button
          className={`create-table-button ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            setCreateTableModalOpen(true);
          }}
          title="创建新表格"
        >
          <FiPlus />
        </button>
      ) : (
        <button
          className={`flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            setCreateTableModalOpen(true);
          }}
        >
          <FiPlus className="mr-1" />
          <span>创建新表格</span>
        </button>
      )}
      
      {createTableModalOpen && (
        <CreateTableModal
          isOpen={createTableModalOpen}
          onClose={() => setCreateTableModalOpen(false)}
          onTableCreated={onTableCreated}
        />
      )}
    </>
  );
}

export default CreateTableButton;