interface RowItem {
  id: string;
  country: string;
  name: string;
  agentCode: string;
  category: string;
  hasPhoto: boolean;
  position: number;
  photoPath: string,
}

const cleanName = (name: string) => {
  return name.replace(/[^a-zA-Zà-üÀ-Ü\u4E00-\u9FA5]/gi, '');
};

const cleanFileName = (fileName: string) => {
  return fileName
    .replace(/_/gi, '-')
    .replace(/\bCOT\b/gi, '')
    .replace(/[^a-zA-Zà-üÀ-Ü\u4E00-\u9FA5]/gi, '');
};

const isNameMatching = (name: string, entry: string) => {
  const cleanedName = cleanName(name);
  const entryRegex = new RegExp(cleanedName, 'gi');
  return entryRegex.test(cleanFileName(entry));
};

const isAgentCodeMatching = (agentCode: string, entry: string) => {
  return entry.includes(agentCode);
};

const parseXlsxToAIDataSource = (
  rows: any[],
  basePhotoPath = '',
  silhouettePhotoPath = '',
  notFoundPlaceholderPath = '',
  directoryEntries: string[] = []
) => {
  const skipRows = 4;
  const HEADER_INDICES = {
    id: 0,
    country: 1,
    name: 2,
    agentCode: 3,
    category: 4,
    hasPhoto: 5,
  };
  const MAX_ITEM_PER_PAGE = 45;
  const MAX_CATEGORY_PER_PAGE = 2;
  const MAX_ITEM_PER_ROW = 15;
  const MAX_ROW_PER_PAGE = MAX_ITEM_PER_PAGE / MAX_ITEM_PER_ROW;
  const dataRows = rows.slice(skipRows + 1);
  const jsonData: RowItem[] = dataRows.map((row) => {
    const id = row[HEADER_INDICES.id];
    const country = row[HEADER_INDICES.country];
    const name = row[HEADER_INDICES.name];
    const agentCode = row[HEADER_INDICES.agentCode];
    const category = row[HEADER_INDICES.category];
    const hasPhotoString = row[HEADER_INDICES.hasPhoto];
    const hasPhoto = hasPhotoString === 'Y';
    let photoPath = '';
    // Scan the photo directory to see if the photo exists, and get the corresponding filename
    if (hasPhoto) {
      let photoEntry = '';
      const photoEntryByName = directoryEntries.find((entry) => isNameMatching(name, entry));
      if (photoEntryByName) {
        photoEntry = photoEntryByName;
      } else {
        const photoEntryByAgentCode = directoryEntries.find((entry) => isAgentCodeMatching(agentCode, entry));
        if (photoEntryByAgentCode) {
          photoEntry = photoEntryByAgentCode;
        }
      }
      if (!photoEntry) {
        photoPath = notFoundPlaceholderPath;
      } else {
        photoPath = `${basePhotoPath}/${photoEntry}`;
      }
    } else {
      photoPath = silhouettePhotoPath;
    }
    return {
      id,
      country,
      name,
      agentCode,
      category,
      hasPhoto,
      position: 1,
      photoPath,
    } as RowItem;
  });

  // Group by category
  let positionCounter = 2;
  const groupedByCategory: Map<string, RowItem[]> = jsonData.reduce((acc, curr) => {
    const { category } = curr;
    if (acc.has(category)) {
      const currCategory = acc.get(category);
      if (currCategory) {
        currCategory.push({
          ...curr,
          position: positionCounter++,
        });
        acc.set(category, currCategory);
      }
    } else {
      acc.set(category, [curr]);
      positionCounter = 2;
    }
    return acc;
  }, new Map());

  const categories = Array.from(groupedByCategory.keys());

  const paginatedCategory: Map<number, RowItem[]> = new Map();
  let currentPage = 1;
  for (let categoryCounter = 1; categoryCounter <= groupedByCategory.size; categoryCounter++) {
    const currentCategoryName = categories[categoryCounter - 1];
    const nextCategoryName = categories[categoryCounter];
    const currentCategory = groupedByCategory.get(currentCategoryName);
    const nextCategory = groupedByCategory.get(nextCategoryName);
    if (!currentCategory) {
      continue;
    }

    const currentCategoryLength = currentCategory.length || 0;
    const nextCategoryLength = nextCategory?.length || 0;
    const currentCategoryRowCount = Math.ceil(currentCategoryLength / MAX_ITEM_PER_ROW);
    const nextCategoryRowCount = Math.ceil(nextCategoryLength / MAX_ITEM_PER_ROW);

    // If the current and the next total row count does not exceed max row per page, combine them into one page
    if (currentCategoryRowCount + nextCategoryRowCount <= MAX_ROW_PER_PAGE) {
      const nextCategoryPositionShiftCount = currentCategoryRowCount * MAX_ITEM_PER_ROW;
      if (nextCategory) {
        nextCategory.forEach((item) => {
          item.position = item.position ? item.position + nextCategoryPositionShiftCount : 0;
        });
        paginatedCategory.set(currentPage, [...currentCategory, ...nextCategory]);
        categoryCounter++;
      } else {
        paginatedCategory.set(currentPage, currentCategory);
      }
    } else if (currentCategoryRowCount >= MAX_ROW_PER_PAGE) {
      const categoryPageCount = Math.ceil(currentCategoryRowCount / MAX_ROW_PER_PAGE);
      for (let currentCategoryPageCounter = 1; currentCategoryPageCounter <= categoryPageCount; currentCategoryPageCounter++) {
        const start = (currentCategoryPageCounter - 1) * MAX_ITEM_PER_PAGE;
        const end = start + MAX_ITEM_PER_PAGE;
        const currentPageItems = currentCategory.slice(start, end);
        currentPageItems.forEach((item) => {
          item.position = item.position ? item.position - start : 1;
        });
        paginatedCategory.set(currentPage, currentPageItems);
        currentPage++;
      }
    } else {
      paginatedCategory.set(currentPage, currentCategory);
    }
    currentPage++;
  }

  // CSV Headers
  const csvHeader = [];
  for (let i = 1; i <= MAX_CATEGORY_PER_PAGE; i++) {
    csvHeader.push(`category${i}`);
  }
  for (let i = 1; i <= MAX_ITEM_PER_PAGE; i++) {
    csvHeader.push(`name${i}`);
    csvHeader.push(`@photo${i}`);
  }

  const csvData = [csvHeader];
  for (let pageCounter = 0; pageCounter < paginatedCategory.size; pageCounter++) {
    const pageData = [];
    const pageItems = paginatedCategory.get(pageCounter + 1);
    if (!pageItems) {
      continue;
    }

    // fill category data
    const pageCategories = Array.from(new Set(pageItems.map((item) => item.category)));
    for (let categoryCounter = 0; categoryCounter < MAX_CATEGORY_PER_PAGE; categoryCounter++) {
      const category = pageCategories[categoryCounter] || '';
      pageData.push(category.replaceAll(',', ' | '));
    }

    // fill item data
    for (let itemCounter = 0; itemCounter < MAX_ITEM_PER_PAGE; itemCounter++) {
      const item = pageItems.find((item) => item.position === itemCounter + 1);
      if (item) {
        pageData.push(item.name);
        pageData.push(item.photoPath);
      } else {
        pageData.push('Firstname Lastname');
        pageData.push(silhouettePhotoPath || '');
      }
    }
    csvData.push(pageData);
  }
  return csvData;
};

export default parseXlsxToAIDataSource;
