figma.showUI(__html__, { width: 340, height: 400 });

// Функция глубокого поиска (рекурсия)
async function walkAndApply(node: SceneNode, varMap: any) {
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const props = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'itemSpacing'];
    for (const prop of props) {
      const val = (node as any)[prop];
      if (val > 0) {
        // Ищем ключ в формате "Padding/16" или "Gap/General/16"
        const key = varMap[`Padding/${val}`] || varMap[`Gap/General/${val}`];
        if (key) {
          try {
            const v = await figma.variables.importVariableByKeyAsync(key);
            node.setBoundVariable(prop as VariableBindableNodeField, v.id);
          } catch (e) { /* пропускаем ошибки */ }
        }
      }
    }
  }
  if ("children" in node) {
    for (const child of node.children) {
      await walkAndApply(child, varMap);
    }
  }
}

figma.ui.onmessage = async (msg) => {
  // 1. Сбор переменных для GitHub
  if (msg.type === 'prepare-export') {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const finalJson: any = {};
    for (const col of collections) {
      for (const varId of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(varId);
        if (v && !v.remote) finalJson[v.name] = v.key;
      }
    }
    figma.ui.postMessage({ type: 'push-to-github', data: finalJson });
  }

  // 2. Применение переменных к макету
  if (msg.type === 'apply-from-github') {
    for (const node of figma.currentPage.selection) {
      await walkAndApply(node, msg.data);
    }
    figma.notify("✨ Макет синхронизирован с GitHub!");
  }
};
