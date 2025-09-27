import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, User, AlertCircle, CheckCircle, Clock, X, Save, Edit, Trash2 } from 'lucide-react';
import { Task } from '../types';
import { tasksAPI, usersAPI, jobsAPI, candidatesAPI } from '../services/api';
import ProtectedComponent from './ProtectedComponent';
import { useAuth } from '../contexts/AuthContext';

interface TasksProps {
  tasks?: Task[]; // Made optional since we'll fetch from backend
  onAddTask?: (taskData: any) => void;
  onEditTask?: (taskId: string, taskData: any) => void;
  onMarkComplete?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAssignTask?: (taskId: string, assignedTo: string) => void;
}

export default function Tasks({}: TasksProps) {
  const { hasPermission, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersWarning, setUsersWarning] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignedTo: 0,
    jobId: null as number | null,
    candidateId: null as number | null,
    priority: 'Medium',
    status: 'Pending',
    dueDate: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load data from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(''); // Clear any previous errors
        
        console.log('Loading tasks data...');
        
        // Try to load users, but don't block other data if forbidden/unavailable
        try {
          const usersResponse = await usersAPI.getUsers();
          if (usersResponse.success && usersResponse.data) {
            setUsers(usersResponse.data.users || []);
            console.log('Users loaded:', usersResponse.data.users?.length || 0);
          } else {
            console.warn('Users API failed:', usersResponse);
            setUsers([]);
            setUsersWarning('Some data could not be loaded (users). You can still view tasks.');
          }
        } catch (usersErr: any) {
          console.warn('Users API error (non-blocking):', usersErr);
          setUsers([]);
          // If 403, show a friendly warning instead of failing the page
          const status = usersErr?.response?.status;
          if (status === 403) {
            setUsersWarning('You do not have permission to view users. Task list is still available.');
          } else {
            setUsersWarning('Could not load users. Task list is still available.');
          }
        }
        
        // Load other data in parallel
        const [tasksResponse, jobsResponse, candidatesResponse] = await Promise.all([
          tasksAPI.getTasks(),
          jobsAPI.getJobs(),
          candidatesAPI.getCandidates()
        ]);

        console.log('Tasks response:', tasksResponse);
        console.log('Jobs response:', jobsResponse);
        console.log('Candidates response:', candidatesResponse);
        if (tasksResponse.success && tasksResponse.data) {
          const tasks = tasksResponse.data.tasks || [];
          setTasks(tasks);
          console.log('Tasks loaded:', tasks.length);
          
          // If no tasks exist, create a sample task for the current user
          if (tasks.length === 0 && users.length > 0) {
            console.log('No tasks found, creating sample task...');
            try {
              const currentUserId = user?.id || users[0]?.id || 1;
              const sampleTask = {
                title: 'Welcome Task',
                description: 'This is a sample task to get you started. You can edit or delete this task.',
                assignedTo: currentUserId,
                priority: 'Medium' as 'Medium',
                status: 'Pending' as 'Pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
                createdBy: currentUserId
              };
              
              const createResponse = await tasksAPI.createTask(sampleTask);
              if (createResponse.success) {
                console.log('Sample task created successfully');
                // Reload tasks
                const reloadResponse = await tasksAPI.getTasks();
                if (reloadResponse.success && reloadResponse.data) {
                  setTasks(reloadResponse.data.tasks || []);
                }
              }
            } catch (createError) {
              console.error('Error creating sample task:', createError);
            }
          }
        } else {
          console.error('Tasks API failed:', tasksResponse);
          // Try to retry once
          try {
            console.log('Retrying tasks API...');
            const retryResponse = await tasksAPI.getTasks();
            if (retryResponse.success && retryResponse.data) {
              setTasks(retryResponse.data.tasks || []);
              console.log('Tasks loaded on retry:', retryResponse.data.tasks?.length || 0);
            } else {
              setError('Failed to load tasks: ' + (tasksResponse.message || 'Unknown error'));
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            setError('Failed to load tasks: ' + (tasksResponse.message || 'Unknown error'));
          }
        }
        // Users already loaded above

        if (jobsResponse.success && jobsResponse.data) {
          setJobs(jobsResponse.data.jobs || []);
          console.log('Jobs loaded:', jobsResponse.data.jobs?.length || 0);
        } else {
          console.error('Jobs API failed:', jobsResponse);
          setError('Failed to load jobs: ' + (jobsResponse.message || 'Unknown error'));
        }

        if (candidatesResponse.success && candidatesResponse.data) {
          setCandidates(candidatesResponse.data.candidates || []);
          console.log('Candidates loaded:', candidatesResponse.data.candidates?.length || 0);
        } else {
          console.error('Candidates API failed:', candidatesResponse);
          setError('Failed to load candidates: ' + (candidatesResponse.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handler functions
  function handleNewTask() {
    setTaskFormData({
      title: '',
      description: '',
      assignedTo: 0,
      jobId: null,
      candidateId: null,
      priority: 'Medium',
      status: 'Pending',
      dueDate: ''
    });
    setErrors({});
    setShowNewTaskModal(true);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo,
      jobId: task.jobId || null,
      candidateId: task.candidateId || null,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate
    });
    setErrors({});
    setShowEditTaskModal(true);
  }

  async function handleMarkComplete(taskId: number) {
    try {
      setLoading(true);
      const response = await tasksAPI.updateTaskStatus(taskId, 'Completed');
      if (response.success) {
        // Refresh tasks list
        const tasksResponse = await tasksAPI.getTasks();
        if (tasksResponse.success && tasksResponse.data) {
          setTasks(tasksResponse.data.tasks || []);
        }
        setError('');
      } else {
        setError('Failed to mark task as complete');
      }
    } catch (err) {
      console.error('Error marking task complete:', err);
      setError('Failed to mark task as complete');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTask(taskId: number) {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await tasksAPI.deleteTask(taskId);
      if (response.success) {
        setTasks(tasks.filter(t => t.id !== taskId));
        setError('');
      } else {
        setError('Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};
    
    if (!taskFormData.title.trim()) {
      newErrors.title = 'Task title is required';
    }
    if (!taskFormData.description.trim()) {
      newErrors.description = 'Task description is required';
    }
    if (!taskFormData.assignedTo || taskFormData.assignedTo === 0) {
      newErrors.assignedTo = 'Assigned person is required';
    }
    if (!taskFormData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }
    
    setErrors(newErrors);
    return (Object.keys(newErrors)?.length || 0) === 0;
  }

  async function handleSubmitTask() {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const taskData = {
        title: taskFormData.title,
        description: taskFormData.description,
        assignedTo: taskFormData.assignedTo,
        jobId: taskFormData.jobId || undefined,
        candidateId: taskFormData.candidateId || undefined,
        priority: taskFormData.priority as 'High' | 'Medium' | 'Low',
        status: taskFormData.status as 'Pending' | 'In Progress' | 'Completed',
        dueDate: taskFormData.dueDate,
        createdBy: 1 // TODO: Get from auth context
      };

      let response;
      if (editingTask) {
        response = await tasksAPI.updateTask(editingTask.id, taskData);
      } else {
        response = await tasksAPI.createTask(taskData);
      }

      if (response.success) {
        // Refresh tasks list
        const tasksResponse = await tasksAPI.getTasks();
        if (tasksResponse.success && tasksResponse.data) {
          setTasks(tasksResponse.data.tasks || []);
        }
        setError('');
        
        // Reset form and close modals
        setTaskFormData({
          title: '',
          description: '',
          assignedTo: 0,
          jobId: null,
          candidateId: null,
          priority: 'Medium',
          status: 'Pending',
          dueDate: ''
        });
        setErrors({});
        setShowNewTaskModal(false);
        setShowEditTaskModal(false);
        setEditingTask(null);
      } else {
        setError(`Failed to ${editingTask ? 'update' : 'create'} task`);
      }
    } catch (err) {
      console.error(`Error ${editingTask ? 'updating' : 'creating'} task:`, err);
      setError(`Failed to ${editingTask ? 'update' : 'create'} task`);
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle size={16} className="text-green-500" />;
      case 'In Progress': return <Clock size={16} className="text-blue-500" />;
      case 'Pending': return <AlertCircle size={16} className="text-yellow-500" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && tasks.find(t => t.dueDate === dueDate)?.status !== 'Completed';
  };

  // Show loading state
  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedComponent module="tasks" action="view">
      <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Failed to load tasks</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Non-blocking warning if users couldn't load */}
      {!error && usersWarning && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm">{usersWarning}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage daily tasks and activities for your hiring process</p>
        </div>
        {hasPermission('tasks', 'create') && (
          <button 
            onClick={handleNewTask}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span>New Task</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-64 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: tasks?.length || 0, color: 'bg-blue-500' },
          { label: 'Pending', value: tasks?.filter(t => t.status === 'Pending')?.length || 0, color: 'bg-yellow-500' },
          { label: 'In Progress', value: tasks?.filter(t => t.status === 'In Progress')?.length || 0, color: 'bg-blue-500' },
          { label: 'Completed', value: tasks?.filter(t => t.status === 'Completed')?.length || 0, color: 'bg-green-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-3 h-8 ${stat.color} rounded`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Task List</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredTasks.map((task) => (
            <div key={task.id} id={`task-${task.id}`} className={`p-6 hover:bg-gray-50 ${isOverdue(task.dueDate) ? 'bg-red-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{task.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        {isOverdue(task.dueDate) && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{task.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <User size={14} />
                          <span>Assigned to {task.assignedToName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar size={14} />
                          <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                  <span onClick={() => {
                    const taskElement = document.getElementById(`task-${task.id}`);
                    if (taskElement) {
                      const detailsElement = taskElement.querySelector('.task-details');
                      if (detailsElement) {
                        detailsElement.classList.toggle('hidden');
                      }
                    }
                  }}>
                    Toggle Details
                  </span>
                </button>
              </div>
              
              {/* Expanded Task Details */}
              <div className="task-details hidden mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Task Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Created Date:</span>
                        <p className="text-sm text-gray-900">{new Date(task.createdDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Due Date:</span>
                        <p className="text-sm text-gray-900">{new Date(task.dueDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Days Remaining:</span>
                        <p className="text-sm text-gray-900">
                          {Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Assignment Details</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Assigned To:</span>
                        <p className="text-sm text-gray-900">{task.assignedToName || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Priority Level:</span>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Current Status:</span>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {(task.jobTitle || task.candidateName) && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Related Information</h4>
                      <div className="space-y-2">
                        {task.jobTitle && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Job:</span>
                            <p className="text-sm text-gray-900">{task.jobTitle}</p>
                          </div>
                        )}
                        {task.candidateName && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Candidate:</span>
                            <p className="text-sm text-gray-900">{task.candidateName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3">Full Description</h4>
                  <p className="text-gray-700 leading-relaxed">{task.description}</p>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  {hasPermission('tasks', 'delete') && (
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center space-x-2"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  )}
                  {hasPermission('tasks', 'edit') && (
                    <button 
                      onClick={() => handleEditTask(task)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                    >
                      <Edit size={16} />
                      <span>Edit Task</span>
                    </button>
                  )}
                  {hasPermission('tasks', 'edit') && (
                    <button 
                      onClick={() => handleMarkComplete(task.id)}
                      disabled={task.status === 'Completed'}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                        task.status === 'Completed' 
                          ? 'bg-gray-400 text-white cursor-not-allowed' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <CheckCircle size={16} />
                      <span>Mark Complete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(filteredTasks?.length || 0) === 0 && (
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or create a new task.</p>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.title ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter task title"
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned To *
                  </label>
                  <select
                    value={taskFormData.assignedTo}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, assignedTo: Number(e.target.value) }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.assignedTo ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select team member</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                  {errors.assignedTo && <p className="text-red-500 text-sm mt-1">{errors.assignedTo}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.dueDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.dueDate && <p className="text-red-500 text-sm mt-1">{errors.dueDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={taskFormData.status}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job (Optional)
                  </label>
                  <select
                    value={taskFormData.jobId || ''}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, jobId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a job (optional)</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candidate (Optional)
                  </label>
                  <select
                    value={taskFormData.candidateId || ''}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, candidateId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a candidate (optional)</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Describe the task in detail..."
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Create Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Task</h2>
              <button
                onClick={() => setShowEditTaskModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={taskFormData.title}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.title ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter task title"
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned To *
                  </label>
                  <select
                    value={taskFormData.assignedTo}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, assignedTo: Number(e.target.value) }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.assignedTo ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select team member</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                  {errors.assignedTo && <p className="text-red-500 text-sm mt-1">{errors.assignedTo}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.dueDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.dueDate && <p className="text-red-500 text-sm mt-1">{errors.dueDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={taskFormData.status}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job (Optional)
                  </label>
                  <select
                    value={taskFormData.jobId || ''}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, jobId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a job (optional)</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candidate (Optional)
                  </label>
                  <select
                    value={taskFormData.candidateId || ''}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, candidateId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a candidate (optional)</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Describe the task in detail..."
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Current Task Info</h4>
                <div className="text-sm">
                  <div>
                    <p className="text-blue-700">Created Date</p>
                    <p className="font-semibold text-blue-900">{new Date(editingTask.createdDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditTaskModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedComponent>
  );
}