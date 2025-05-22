import { useMagicalArrayMap, useMagicalMapComputed, useMagicalObjectMap } from "@/utils/magicalMap";
import { useMemo } from "react";

export default
    function ExampleComponent() {
    const arrayMapResult = useMagicalArrayMap<string>();
    const userMapResult = useMagicalObjectMap(() => ({ name: '', age: 0 }));

    // Extract map and version for easier use
    const { map: arrayMap, version: arrayVersion } = arrayMapResult;
    const { map: userMap, version: userVersion } = userMapResult;

    // Computed values that automatically update when maps change
    const totalItems = useMagicalMapComputed(
        arrayMapResult,
        (map) => map.toArray().reduce((sum, arr) => sum + arr.length, 0)
    );

    const averageAge = useMagicalMapComputed(
        userMapResult,
        (map) => {
            const users = map.toArray();
            if (users.length === 0) return 0;
            return users.reduce((sum, user) => sum + user.age, 0) / users.length;
        }
    );

    // You can also use the version directly in useMemo
    const categoryCount = useMemo(() => {
        return arrayMap.keys().length;
    }, [arrayVersion]);

    const addItem = (category: string, item: string) => {
        arrayMap[category].push(item);
    };

    const updateUser = (userId: string, updates: Partial<{ name: string; age: number }>) => {
        Object.assign(userMap[userId], updates);
    };

    return (
        <div>
            <div>
                <h3>Statistics:</h3>
                <p>Total Items: {totalItems}</p>
                <p>Category Count: {categoryCount}</p>
                <p>Average User Age: {averageAge.toFixed(1)}</p>
            </div>

            <button onClick={() => addItem('fruits', 'apple')}>
                Add Apple to Fruits
            </button>
            <button onClick={() => addItem('vegetables', 'carrot')}>
                Add Carrot to Vegetables
            </button>
            <button onClick={() => updateUser('user1', { name: 'John', age: 25 })}>
                Update User 1
            </button>
            <button onClick={() => updateUser('user2', { name: 'Jane', age: 30 })}>
                Update User 2
            </button>

            <div>
                <h3>Arrays:</h3>
                {arrayMap.keys().map(key => (
                    <div key={key}>
                        {key}: {JSON.stringify(arrayMap[key])}
                    </div>
                ))}
            </div>

            <div>
                <h3>Users:</h3>
                {userMap.keys().map(key => (
                    <div key={key}>
                        {key}: {JSON.stringify(userMap[key])}
                    </div>
                ))}
            </div>

            <button onClick={() => arrayMap.clear()}>Clear Arrays</button>
            <button onClick={() => userMap.clear()}>Clear Users</button>
        </div>
    );
}
