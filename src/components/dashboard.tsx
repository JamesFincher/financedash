"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  parseISO,
  isBefore,
  isAfter,
  addWeeks,
  isSameDay,
} from "date-fns";
import { v4 as uuidv4 } from "uuid";

interface Bill {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  dueDate: string;
  recurrence: "none" | "weekly" | "monthly" | "yearly";
  skipped: boolean;
  originalId?: string;
  deletedFromDate?: string; // New property to mark deletion cutoff
}

interface Todo {
  id: number;
  task: string;
  completed: boolean;
  dueDate: string;
}

interface Paycheck {
  id: number;
  amount: number;
  date: string;
}

const isRecurringInstance = (bill: Bill, originalBill: Bill) => {
  return bill.originalId === originalBill.id;
};

export function DashboardComponent() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [newBill, setNewBill] = useState({
    name: "",
    amount: "",
    dueDate: "",
    recurrence: "none",
  });
  const [newTodo, setNewTodo] = useState({ task: "", dueDate: "" });
  const [newPaycheck, setNewPaycheck] = useState({ amount: "", date: "" });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [updateOption, setUpdateOption] = useState<"current" | "future">(
    "current"
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);

  // New state for original bills
  const [originalBills, setOriginalBills] = useState<Bill[]>([]);
  
  // New state for edited bills
  const [editedBills, setEditedBills] = useState<{ [key: string]: Bill }>({});

  // New state for deleted bills
  const [deletedBills, setDeletedBills] = useState<{ [key: string]: boolean }>({});

  const generateRecurringBills = useCallback(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const generatedBills = originalBills.flatMap((bill) => {
      if (bill.recurrence !== "none") {
        let currentDate = new Date(bill.dueDate);
        const instances = [];

        while (isBefore(currentDate, monthEnd)) {
          const dueDateStr = currentDate.toISOString().split("T")[0];
          const key = `${bill.id}-${dueDateStr}`;

          // Check if bill generation is stopped from a certain date
          if (bill.deletedFromDate) {
            const deletedFrom = parseISO(bill.deletedFromDate);
            if (isAfter(currentDate, deletedFrom) || isSameDay(currentDate, deletedFrom)) {
              break; // Stop generating future instances
            }
          }

          if (
            isWithinInterval(currentDate, { start: monthStart, end: monthEnd }) &&
            !instances.some(
              (existingBill) =>
                existingBill.originalId === bill.id &&
                existingBill.dueDate === dueDateStr
            ) &&
            !deletedBills[key] // Exclude deleted bills
          ) {
            if (editedBills[key]) {
              instances.push(editedBills[key]);
            } else {
              instances.push({
                ...bill,
                id: uuidv4(),
                dueDate: dueDateStr,
                paid: false,
                skipped: false,
                originalId: bill.id,
              });
            }
          }

          if (bill.recurrence === "weekly")
            currentDate = addWeeks(currentDate, 1);
          if (bill.recurrence === "monthly")
            currentDate = addMonths(currentDate, 1);
          if (bill.recurrence === "yearly")
            currentDate = addMonths(currentDate, 12);
        }

        return instances;
      }
      return [];
    });

    return generatedBills;
  }, [originalBills, currentMonth, editedBills, deletedBills]);

  useEffect(() => {
    const recurringBills = generateRecurringBills();
    
    // Filter originalBills to include only non-recurring bills due in the current month
    const filteredOriginalBills = originalBills.filter((bill) =>
      bill.recurrence === "none" &&
      isWithinInterval(new Date(bill.dueDate), {
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      })
    );
    
    // Set bills to only include filtered original bills and generated recurring bills
    setBills([...filteredOriginalBills, ...recurringBills]);
  }, [currentMonth, originalBills, generateRecurringBills]);

  const addBill = () => {
    if (newBill.name && newBill.amount && newBill.dueDate) {
      const newOriginalBill: Bill = {
        id: uuidv4(),
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        paid: false,
        dueDate: newBill.dueDate,
        recurrence: newBill.recurrence as Bill["recurrence"],
        skipped: false,
      };
      setOriginalBills((prevOriginalBills) => [...prevOriginalBills, newOriginalBill]);
      setNewBill({ name: "", amount: "", dueDate: "", recurrence: "none" });
    }
  };

  const updateBill = (id: string, updates: Partial<Bill>) => {
    const billToUpdate = originalBills.find((bill) => bill.id === id) || bills.find((bill) => bill.id === id && bill.originalId);

    if (!billToUpdate) return;

    if (updateOption === "current") {
      const key = `${billToUpdate.originalId || billToUpdate.id}-${billToUpdate.dueDate}`;
      setEditedBills((prev) => ({
        ...prev,
        [key]: { ...billToUpdate, ...updates },
      }));
    } else {
      setOriginalBills((prevOriginalBills) =>
        prevOriginalBills.map((bill) =>
          bill.id === (billToUpdate.originalId || billToUpdate.id) ? { ...bill, ...updates } : bill
        )
      );
    }
    setEditingBill(null);
  };

  const deleteBill = (id: string, deleteAll: boolean) => {
    const billToDelete =
      originalBills.find((bill) => bill.id === id) ||
      bills.find((bill) => bill.id === id && bill.originalId);

    if (!billToDelete) return;

    if (deleteAll) {
      // Set deletedFromDate to the start of the current month to exclude current and future bills
      const startOfCurrentMonth = startOfMonth(currentMonth).toISOString().split("T")[0];
      setOriginalBills((prevOriginalBills) =>
        prevOriginalBills.map((bill) =>
          bill.id === (billToDelete.originalId || billToDelete.id)
            ? { ...bill, deletedFromDate: startOfCurrentMonth }
            : bill
        )
      );

      // Remove related entries from editedBills and deletedBills
      setEditedBills((prevEditedBills) => {
        const updated = { ...prevEditedBills };
        Object.keys(updated).forEach((key) => {
          if (
            key.startsWith(`${billToDelete.originalId || billToDelete.id}-${billToDelete.dueDate}`)
          ) {
            delete updated[key];
          }
        });
        return updated;
      });

      setDeletedBills((prevDeletedBills) => {
        const updated = { ...prevDeletedBills };
        Object.keys(updated).forEach((key) => {
          if (
            key.startsWith(`${billToDelete.originalId || billToDelete.id}-${billToDelete.dueDate}`)
          ) {
            delete updated[key];
          }
        });
        return updated;
      });

      // // Remove bill instances from the current month
      // setBills((prevBills) =>
      //   prevBills.filter(
      //     (bill) =>
      //       bill.originalId !== (billToDelete.originalId || billToDelete.id) &&
      //       bill.id !== billToDelete.id
      //   )
      // );
      // // Removed the above block to let useEffect handle bill updates
    } else {
      // For deleting a single occurrence
      const key = `${billToDelete.originalId || billToDelete.id}-${billToDelete.dueDate}`;
      setDeletedBills((prev) => ({
        ...prev,
        [key]: true,
      }));
      setBills((prevBills) =>
        prevBills.filter((bill) => bill.id !== id)
      );
    }
    setBillToDelete(null);
    setShowDeleteDialog(false);
  };

  const skipBill = (id: string) => {
    setBills((prevBills) =>
      prevBills.map((bill) =>
        bill.id === id ? { ...bill, skipped: true } : bill
      )
    );
  };

  const addTodo = () => {
    if (newTodo.task && newTodo.dueDate) {
      setTodos((prevTodos) => [
        ...prevTodos,
        {
          id: Date.now(),
          task: newTodo.task,
          completed: false,
          dueDate: newTodo.dueDate,
        },
      ]);
      setNewTodo({ task: "", dueDate: "" });
    }
  };

  const updateTodo = (id: number, updates: Partial<Todo>) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo))
    );
  };

  const deleteTodo = (id: number) => {
    setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  };

  const addPaycheck = () => {
    if (newPaycheck.amount && newPaycheck.date) {
      setPaychecks((prevPaychecks) => [
        ...prevPaychecks,
        {
          id: Date.now(),
          amount: parseFloat(newPaycheck.amount),
          date: newPaycheck.date,
        },
      ]);
      setNewPaycheck({ amount: "", date: "" });
    }
  };

  const deletePaycheck = (id: number) => {
    setPaychecks((prevPaychecks) =>
      prevPaychecks.filter((paycheck) => paycheck.id !== id)
    );
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthlyBills = bills.filter((bill) =>
    isWithinInterval(new Date(bill.dueDate), {
      start: monthStart,
      end: monthEnd,
    })
  );

  const monthlyTodos = todos.filter((todo) =>
    isWithinInterval(parseISO(todo.dueDate), {
      start: monthStart,
      end: monthEnd,
    })
  );

  const totalBills = monthlyBills.reduce(
    (sum, bill) => sum + (bill.skipped ? 0 : bill.amount),
    0
  );
  const unpaidBills = monthlyBills
    .filter((bill) => !bill.paid && !bill.skipped)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const completedTodos = monthlyTodos.filter((todo) => todo.completed).length;
  const monthlyPaychecks = paychecks.filter((paycheck) =>
    isWithinInterval(new Date(paycheck.date), {
      start: monthStart,
      end: monthEnd,
    })
  );
  const totalPaychecks = monthlyPaychecks.reduce(
    (sum, paycheck) => sum + paycheck.amount,
    0
  );
  const balance = totalPaychecks - totalBills;

  const weekStart = startOfWeek(currentMonth);
  const weekEnd = endOfWeek(currentMonth);

  const weeklyBills = monthlyBills
    .filter((bill) =>
      isWithinInterval(new Date(bill.dueDate), {
        start: weekStart,
        end: weekEnd,
      })
    )
    .reduce((sum, bill) => sum + (bill.skipped ? 0 : bill.amount), 0);

  const weeklyPaychecks = monthlyPaychecks
    .filter((paycheck) =>
      isWithinInterval(new Date(paycheck.date), {
        start: weekStart,
        end: weekEnd,
      })
    )
    .reduce((sum, paycheck) => sum + paycheck.amount, 0);

  const weeklyBalance = weeklyPaychecks - weeklyBills;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Personal Finance Dashboard</h1>
      <div className="flex justify-between items-center mb-4">
        <Button
          onClick={() =>
            setCurrentMonth((prevMonth) => addMonths(prevMonth, -1))
          }
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          onClick={() =>
            setCurrentMonth((prevMonth) => addMonths(prevMonth, 1))
          }
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] mb-4">
              {monthlyBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex justify-between items-center mb-2"
                >
                  {editingBill && editingBill.id === bill.id ? (
                    <>
                      <Input
                        value={editingBill.name}
                        onChange={(e) =>
                          setEditingBill({
                            ...editingBill,
                            name: e.target.value,
                          })
                        }
                        className="w-1/5"
                      />
                      <Input
                        type="number"
                        value={editingBill.amount}
                        onChange={(e) =>
                          setEditingBill({
                            ...editingBill,
                            amount: parseFloat(e.target.value),
                          })
                        }
                        className="w-1/5"
                      />
                      <Input
                        type="date"
                        value={editingBill.dueDate}
                        onChange={(e) =>
                          setEditingBill({
                            ...editingBill,
                            dueDate: e.target.value,
                          })
                        }
                        className="w-1/5"
                      />
                      <Select
                        value={editingBill.recurrence}
                        onValueChange={(value) =>
                          setEditingBill({
                            ...editingBill,
                            recurrence: value as Bill["recurrence"],
                          })
                        }
                      >
                        <SelectTrigger className="w-1/5">
                          <SelectValue placeholder="Recurrence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button>Save</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Bill</DialogTitle>
                            <DialogDescription>
                              Do you want to update only this bill or all future
                              occurrences?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                setUpdateOption("current");
                                updateBill(bill.id, editingBill);
                              }}
                            >
                              Update This Bill
                            </Button>
                            <Button
                              onClick={() => {
                                setUpdateOption("future");
                                updateBill(bill.id, editingBill);
                              }}
                            >
                              Update All Future Bills
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : (
                    <>
                      <span className={bill.skipped ? "line-through" : ""}>
                        {bill.name}
                      </span>
                      <span className={bill.skipped ? "line-through" : ""}>
                        ${bill.amount.toFixed(2)}
                      </span>
                      <span>{format(new Date(bill.dueDate), "MMM dd")}</span>
                      <span>{bill.recurrence}</span>
                      <Switch
                        checked={bill.paid}
                        onCheckedChange={(checked) =>
                          updateBill(bill.id, { paid: checked })
                        }
                        disabled={bill.skipped}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingBill(bill)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skipBill(bill.id)}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setBillToDelete(bill);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                placeholder="Bill name"
                value={newBill.name}
                onChange={(e) =>
                  setNewBill({ ...newBill, name: e.target.value })
                }
              />
              <Input
                type="number"
                placeholder="Amount"
                value={newBill.amount}
                onChange={(e) =>
                  setNewBill({ ...newBill, amount: e.target.value })
                }
              />
              <Input
                type="date"
                value={newBill.dueDate}
                onChange={(e) =>
                  setNewBill({ ...newBill, dueDate: e.target.value })
                }
              />
              <Select
                value={newBill.recurrence}
                onValueChange={(value) =>
                  setNewBill({ ...newBill, recurrence: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Recurrence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addBill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Todo List</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] mb-4">
              {monthlyTodos.map((todo) => (
                <div key={todo.id} className="flex items-center mb-2">
                  {editingTodo && editingTodo.id === todo.id ? (
                    <>
                      <Input
                        value={editingTodo.task}
                        onChange={(e) =>
                          setEditingTodo({
                            ...editingTodo,
                            task: e.target.value,
                          })
                        }
                        className="mr-2"
                      />
                      <Input
                        type="date"
                        value={editingTodo.dueDate}
                        onChange={(e) =>
                          setEditingTodo({
                            ...editingTodo,
                            dueDate: e.target.value,
                          })
                        }
                        className="mr-2"
                      />
                      <Button
                        onClick={() => {
                          updateTodo(todo.id, editingTodo);
                          setEditingTodo(null);
                        }}
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Switch
                        checked={todo.completed}
                        onCheckedChange={(checked) =>
                          updateTodo(todo.id, { completed: checked })
                        }
                        className="mr-2"
                      />
                      <span className={todo.completed ? "line-through" : ""}>
                        {todo.task}
                      </span>
                      <span className="ml-2">
                        {format(parseISO(todo.dueDate), "MMM dd")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingTodo(todo)}
                        className="ml-auto mr-2"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTodo(todo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                placeholder="New todo"
                value={newTodo.task}
                onChange={(e) =>
                  setNewTodo({ ...newTodo, task: e.target.value })
                }
              />
              <Input
                type="date"
                value={newTodo.dueDate}
                onChange={(e) =>
                  setNewTodo({ ...newTodo, dueDate: e.target.value })
                }
              />
              <Button onClick={addTodo}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold mb-2">
              Weekly ({format(weekStart, "MMM dd")} -{" "}
              {format(weekEnd, "MMM dd")})
            </h3>
            <p>Bills Due: ${weeklyBills.toFixed(2)}</p>
            <p>Paychecks: ${weeklyPaychecks.toFixed(2)}</p>
            <p>Balance: ${weeklyBalance.toFixed(2)}</p>

            <h3 className="font-semibold mt-4 mb-2">
              Monthly ({format(monthStart, "MMM dd")} -{" "}
              {format(monthEnd, "MMM dd")})
            </h3>
            <p>Total Bills: ${totalBills.toFixed(2)}</p>
            <p>Unpaid Bills: ${unpaidBills.toFixed(2)}</p>
            <p>Total Paychecks: ${totalPaychecks.toFixed(2)}</p>
            <p>Current Balance: ${balance.toFixed(2)}</p>
            <p>
              Completed Todos: {completedTodos} / {monthlyTodos.length}
            </p>
            <p>
              Financial Health: {balance < 0 ? "Review spending" : "On track"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paychecks</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px] mb-4">
              {monthlyPaychecks.map((paycheck) => (
                <div
                  key={paycheck.id}
                  className="flex justify-between items-center mb-2"
                >
                  <span>{format(new Date(paycheck.date), "MMM dd, yyyy")}</span>
                  <span>${paycheck.amount.toFixed(2)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePaycheck(paycheck.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Paycheck amount"
                value={newPaycheck.amount}
                onChange={(e) =>
                  setNewPaycheck({ ...newPaycheck, amount: e.target.value })
                }
              />
              <Input
                type="date"
                value={newPaycheck.date}
                onChange={(e) =>
                  setNewPaycheck({ ...newPaycheck, date: e.target.value })
                }
              />
              <Button onClick={addPaycheck}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bill</DialogTitle>
            <DialogDescription>
              Do you want to delete only this bill or all future occurrences?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => deleteBill(billToDelete?.id || "", false)}>
              Delete This Bill
            </Button>
            <Button onClick={() => deleteBill(billToDelete?.id || "", true)}>
              Delete All Future Bills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}