export function resolveNotificationTarget(relatedType, relatedId, courseId, relatedCommentId = 0) {
  // 课程帖评论 — 跳课程详情论坛 Tab + 定位帖子 + 滚动评论
  if (relatedType === 'post' && courseId) {
    return {
      page: 'course-detail',
      data: {
        id: courseId,
        tab: 'forum',
        targetPostId: relatedId || 0,
        scrollToCommentId: relatedCommentId || 0
      }
    };
  }

  // 新资料 — 跳课程详情资料 Tab
  if (relatedType === 'material' && courseId) {
    return { page: 'course-detail', data: { id: courseId, tab: 'materials' } };
  }

  // 课程交友帖 — 跳课程详情交友 Tab
  if (relatedType === 'course_square_post' && courseId) {
    return {
      page: 'course-detail',
      data: {
        id: courseId,
        tab: 'square',
        scrollToCommentId: relatedCommentId || 0
      }
    };
  }

  // 发现帖 — 跳发现帖详情
  if (relatedType === 'explore_post' && relatedId) {
    return {
      page: 'explore-post-detail',
      data: relatedCommentId
        ? { id: relatedId, commentId: relatedCommentId }
        : relatedId
    };
  }

  // 广场帖 — 跳广场帖详情
  if (relatedType === 'square_post' && relatedId) {
    return { page: 'square-post', data: relatedId };
  }

  // 邀约 — 跳发现页邀约 Tab
  if (relatedType === 'invite') {
    return { page: 'explore', data: { tab: 'invites', inviteId: relatedId || 0 } };
  }

  // 用户 — 跳用户主页
  if (relatedType === 'user' && relatedId) {
    return { page: 'profile-user', data: relatedId };
  }

  // 卡片 — 跳发现页
  if (relatedType === 'card' && relatedId) {
    return { page: 'explore', data: null };
  }

  return null;
}
