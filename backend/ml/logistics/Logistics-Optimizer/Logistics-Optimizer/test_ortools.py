from ortools.constraint_solver import pywrapcp
starts = [0, 1]
ends = [2, 2] # both vehicles end at node 2
manager = pywrapcp.RoutingIndexManager(3, 2, starts, ends)
routing = pywrapcp.RoutingModel(manager)

print("Nodes:", manager.GetNumberOfNodes())
print("Indices:", manager.GetNumberOfIndices())
print("routing.Size()", routing.Size())

for i in range(manager.GetNumberOfIndices()):
    print(f"Index {i} -> Node {manager.IndexToNode(i)}")

for n in range(manager.GetNumberOfNodes()):
    try:
        print(f"Node {n} -> Index {manager.NodeToIndex(n)}")
    except Exception as e:
        print(f"Node {n} Exception: {e}")
