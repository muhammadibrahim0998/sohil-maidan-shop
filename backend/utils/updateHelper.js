import SystemUpdate from '../models/SystemUpdate.js';

/**
 * Creates or updates a system update entry.
 * If an update for the same category exists from the last 24 hours, it appends the item.
 * Otherwise, it creates a new entry.
 */
export const logSystemUpdate = async (category, iconType, item) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find a recent active update in the same category
    let update = await SystemUpdate.findOne({
      category,
      isActive: true,
      createdAt: { $gte: oneDayAgo }
    });

    if (update) {
      // Avoid duplicate items in the same update entry
      const itemsList = Array.isArray(update.items) ? update.items : [];
      if (!itemsList.includes(item)) {
        itemsList.push(item);
        await SystemUpdate.findByIdAndUpdate(update.id || update._id, { items: itemsList });
      }
    } else {
      // Create new update entry using MySQL BaseModel
      update = await SystemUpdate.create({
        category,
        iconType,
        items: [item],
        isActive: true
      });
    }
    return update;
  } catch (err) {
    console.error("Failed to log system update:", err);
  }
};
